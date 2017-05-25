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

# Supported image types
Currently the following are supported:
- PNG, JPG & GIF
