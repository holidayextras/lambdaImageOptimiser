zip -r -q deploymentPackage.zip .
aws lambda update-function-code --function-name lambdaImageResizer --zip-file fileb://deploymentPackage.zip --publish
rm -rf deploymentPackage.zip