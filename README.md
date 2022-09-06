# CDK ECS 

# Prereqs:
    nodejs LTS: https://nodejs.org/en/download/ 
    AWS CLI Installed and configured: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites 
    CDK v2: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
    Docker: https://www.docker.com/products/docker-desktop/ 
    
## Update the Target Region specified 
    updated region in the env varible in /bin/cdk-app-deploy.ts

## Deploy the Stack
    cdk deploy ecs-webapp 
    answer 'y' at prompt 

## Copy/Click the ALB Url display in terminal once stack deployment completes 
    To confirm successful deployment 

## Destroy the stack: 
    cdk destroy ecs-webapp 



## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

