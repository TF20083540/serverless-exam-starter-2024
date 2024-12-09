import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movies, movieCasts, movieAwards, movieCrew } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });
    

    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    const movieCrewTable = new dynamodb.Table(this, "MovieCrewTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "crewRole", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCrew",
    });

    movieCrewTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "crewRole", type: dynamodb.AttributeType.STRING },
    });

    const movieAwardsTable = new dynamodb.Table(this, "MovieAwardsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "awardBody", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieAwards",
    });



    // Functions
    const getMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          MOVIES_TABLE_NAME: moviesTable.tableName,
          CAST_TABLE_NAME: movieCastsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieCastMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCastMemberFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieCastMember.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieCastsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const deleteMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "DeleteMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/deleteMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    //New lambda function for Crew
    const getMovieCrewMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCrewMemberFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieCrew.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieCrewTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),
            [movieAwardsTable.tableName]: generateBatch(movieAwards),
            [movieCrewTable.tableName]: generateBatch(movieCrew),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          moviesTable.tableArn,
          movieCastsTable.tableArn,
          movieAwardsTable.tableArn,
          movieCrewTable.tableArn,
        ],
      }),
    });

    // REST API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      // 👇 enable CORS
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");

    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    movieEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
    );

    movieEndpoint.addMethod(
      "DELETE",
      new apig.LambdaIntegration(deleteMovieByIdFn, { proxy: true })
    );    

    const movieCastEndpoint = movieEndpoint.addResource("cast");
    movieCastEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true })
    );

    const movieCrewEndpoint = movieEndpoint.addResource("crew");
    movieCrewEndpoint.addMethod(
      "GET", 
      new apig.LambdaIntegration(getMovieCrewMembersFn, {proxy: true})
    )



    // Permissions;
    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadWriteData(deleteMovieByIdFn);
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieByIdFn);
    movieCrewTable.grantReadData(getMovieCrewMembersFn);
  }

  //Missing Authentication Token error.
  //Get the same error by doing a different order -> /movies/1234/crew/director
  //While this order (sans role -> /movies/1234/crew )  Message	"Missing movie Id or role"
}
