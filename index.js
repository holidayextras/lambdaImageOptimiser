'use strict'

const async = require('async')
const AWS = require('aws-sdk')
const gm = require('gm').subClass({
  imageMagick: true
})
const path = require('path')

AWS.config.update({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY
  },
  region: process.env.AWS_REGION
})
const s3 = new AWS.S3()

// Allowed extensions to convert
const allowedFileExtensions = ['.jpg', '.gif', '.png']

// scaleFactor means the original size will be devided by that number
const outputSizes = [{
  scaleFactor: 2,
  suffix: 'large'
}, {
  scaleFactor: 4,
  suffix: 'medium'
}, {
  scaleFactor: 8,
  suffix: 'small'
}, {
  scaleFactor: 12,
  suffix: 'thumbnail'
}]

const processEvent = (event, context) => {
  const BUCKET = event.Records[0].s3.bucket.name

  // Make sure to replace spaces etc. otherwise s3 can't read the image path
  const sourcePath = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))

  // Get extension and filename
  const { ext, name } = path.parse(sourcePath)

  // Check if the uploaded file has a type that we can't convert or don't want to convert
  if (!allowedFileExtensions.includes(ext) || outputSizes.some(s => sourcePath.indexOf(s.suffix) >= 0)) {
    return context.fail(`FileType of ${sourcePath} is not supported for conversion or is itself already a converted file`)
  }

  // Loop and half the width a couple of times to create smaller variants of the same image
  async.forEachOf(outputSizes, outputSize => {
    async.waterfall([

      function download (next) {
        // Getting object that has just been uploaded from s3
        s3.getObject({
          Bucket: BUCKET,
          Key: sourcePath
        }, next)
      },

      function process (data, next) {
        if (!data) {
          return context.fail('No data')
        }

        // We want to prevent an infinite loop as the `putObject` will invoke this same Lambda
        if (data.Metadata.resized) {
          return context.fail('File has previously been resized, stopping script here.')
        }

        // Create local image from stream and check the size of the image
        gm(data.Body).size({
          bufferStream: true
        }, function (error, size) {
          if (error) {
            return context.fail(error)
          }

          // Calculate the new size based on the scaleFactor
          const width = Math.floor(size.width / outputSize.scaleFactor)
          const height = Math.floor(size.height / outputSize.scaleFactor)

          console.log(`Resizing ${name}${ext} to ${width}px x ${height}px`)

          // Doing the actual resizing
          this.resize(width, height).toBuffer((error, buffer) => {
            if (error) {
              return context.fail(error)
            }
            next(null, buffer)
          })
        })
      },

      function upload (data, next) {
        // Create new filename with size identifier in the name
        const newFileName = sourcePath.replace(`${ext}`, `_${outputSize.suffix}${ext}`)

        console.log(`Uploading ${newFileName} to s3 bucket ${BUCKET}`)
        s3.putObject({
          Bucket: BUCKET,
          Key: newFileName,
          Body: data,
          Metadata: {
            'resized': 'true'
          }
        }, next)
      }
    ], (error, result) => {
      if (error) {
        return context.fail(error)
      }
      context.succeed()
    })
  })
}

exports.handler = (event, context, callback) => {
  if (!event || !event.Records) {
    return callback(null, 'Cancelling as there is no information to use')
  }
  processEvent(event, context)
}
