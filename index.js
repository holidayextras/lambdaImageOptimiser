'use strict'

const async = require('async')
const AWS = require('aws-sdk')
const gm = require('gm').subClass({
  imageMagick: true
})

AWS.config.update({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY, // Is set in advanced settings
    secretAccessKey: process.env.SECRET_KEY // Is set in advanced settings
  },
  region: process.env.AWS_REGION // Is standard configuraiton
})
const s3 = new AWS.S3()

// Image quality, the bigger the number, the bigger the file size
const IMG_QUALITY = Number(process.env.IMG_QUALITY) || 85 // up to 100

// Allowed extensions to convert
const allowedFileExtensions = ['.jpg', '.gif', '.png']

const processEvent = (event, context) => {
  const BUCKET = event.Records[0].s3.bucket.name

  // Make sure to replace spaces etc. otherwise s3 can't read the image path
  const sourcePath = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))

  // Get extension and filename
  const extension = sourcePath.substring(sourcePath.lastIndexOf('.'))

  // Check if the uploaded file has a type that we can't convert or don't want to convert
  if (!allowedFileExtensions.includes(extension.toLowerCase()) || /_original/.test(sourcePath)) {
    return console.log(`FileType of ${sourcePath} is not supported for conversion.`)
  }

  async.waterfall([

    /**
     * Reads in the raw data of the uploaded image so we can manipulate and check it
     * @param  {Function} next calls next function in the flow
     */
    function download (next) {
      console.log(`Downloading ${sourcePath}`)
      s3.getObject({
        Bucket: BUCKET,
        Key: sourcePath
      }, next)
    },

    /**
     * Checks the raw data to see if anything needs doing.
     * Compresses the file with the same quality and compression or with the default values
     * @param  {Object} data Meta data from the loaded image
     * @param  {Function} next calls next function in the flow
     */
    function process (data, next) {
      if (!data) {
        return context.fail('No data')
      }

      // We want to prevent an infinite loop as the `putObject` will invoke this same Lambda
      if (data.Metadata.optimised) {
        return console.log(`Stopping as ${sourcePath} has been previously optimised.`)
      }

      // Create local image from stream and check the size of the image
      gm(data.Body).identify({
        bufferStream: true
      }, function (error, data) {
        if (error) {
          return context.fail(error)
        }

        // Compress image with existing quality and compression
        // This might turn out to be bigger in filesize but the next step will check this
        this
          .quality(Math.min(data.Quality, IMG_QUALITY))
          .compress(data.Compression || 'JPEG')
          .toBuffer((error, buffer) => {
            if (error) {
              return context.fail(error)
            }
            next(null, data, buffer)
          })
      })
    },

    /**
     * Checks the filesize of the original and the new compressed image.
     * It will work out if we need to overwrite the original and if we want to keep a copy
     * of the original
     * @param  {Object} originalData Meta data from the original image
     * @param  {Buffer} buffer the raw data from the compressed image
     * @param  {Function} next calls next function in the flow
     */
    function upload (originalData, buffer, next) {
      // Identify new optimised image for size
      gm(buffer).identify({
        bufferStream: true
      }, function (error, data) {
        if (error) {
          return context.fail(error)
        }
        console.log(`Optimised filesize: ${data.Filesize} vs original filesize: ${originalData.Filesize}`)

        // Checking if optimised version has a smaller filesize
        if (parseFloat(data.Filesize) < parseFloat(originalData.Filesize)) {
          console.log('The new file is smaller so I\'m keeping it')

          if (process.env.KEEP_ORIGINAL) {
            const copiedSource = sourcePath.replace(extension, `_orginal${extension}`)
            console.log(`Saving copy of original to ${copiedSource}`)
            // Save a copy of the original just in case
            s3.copyObject({
              Bucket: BUCKET,
              CopySource: `${BUCKET}/${sourcePath}`,
              Key: copiedSource
            }, (error) => {
              if (error) console.log(error)
            })
          }

          console.log(`Overwritting ${sourcePath} on s3 bucket ${BUCKET} with smaller version`)
          // Overwrite original
          s3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            Key: sourcePath,
            Metadata: {
              'optimised': 'true'
            }
          }, next)
        } else {
          console.log('Not saving the new file as the original is smaller')
        }
      })
    }
  ], (error, result) => {
    if (error) {
      return context.fail(error)
    }
    context.done()
  })
}

exports.handler = (event, context, callback) => {
  if (!event || !event.Records) {
    return callback(null, 'Cancelling as there is no information to use')
  }
  processEvent(event, context)
}
