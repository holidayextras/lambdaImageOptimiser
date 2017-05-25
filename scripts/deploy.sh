zip -r -q deploymentPackage.zip .
aws lambda update-function-code --function-name lambdaImageOptimiser --zip-file fileb://deploymentPackage.zip --publish
rm -rf deploymentPackage.zip