# lambdaImageOptimiser

This repo can be used as a Lambda function on AWS. 
It will try to optimise any image that is uploaded by checking the original, run it through the code.
If the file size is smaller with the same dimensions, it will be saved.
This will gives us the ability to display optimised images on the front-end by selecting the closest relevant size.

# How does it work
Set this Lambda function up as a notification on an s3 bucket with a 'Put' event.
(Go to the bucket you want this on, click the 'Properties' tab, click on the 'Events' box and 'Add notification' as shown below)

![Screenshot](screenshot.png)

This will now trigger the lambdaImageOptimiser everytime someone uploads an image to this bucket.
The image gets checked for type and GraphicsMagick & ImageMagick will try and optimise it.
The optimised image gets checked for filesize against the orginal and saved if its smaller than the original.
Optionally a copy of the original will be saved (`KEEP_ORIGINAL`).

# Options that need to be or can be set in AWS:
- `ACCESS_KEY` - your IAM access key for AWS
- `SECRET_KEY` - your IAM secret key for AWS
- `IMG_QUALITY` [optional] (integer ranging from 1 to 100) the image quality to optimise to, this defaults to 85 (the uploaded image quality will be used if this is smaller)
- `KEEP_ORIGNAL` [optional] if this is set, the orignal image will be kept if the optimised image is smaller in file size

# Supported image types
Currently the following are supported:
- PNG, JPG & GIF

# TODO:
- Tests
- More config