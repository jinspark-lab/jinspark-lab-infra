
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

exports.handler = async function (event, context) {
    const responseHeader = {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    };
    const errorHandler = (err) => {
        console.log(err);
        resolve({
            statusCode: 400,
            headers: responseHeader,
            body: JSON.stringify(err)
        });
    };

    return new Promise(function (resolve, reject) {
        try {
            const contentId = event.pathParameters.contentId;
            const requestId = event.requestContext.requestId;

            console.log("ContentId : " + contentId);
            console.log("RequestId : " + requestId);

            dynamodb.getItem({
                TableName: 'SharableDDB',
                Key: {
                    'UUID': { S: '' + contentId }
                }
                // ProjectionExpression: 'contentUrl'
            }, function (err, data) {
                if (err) {
                    errorHandler(err);
                } else {
                    if (data.Item.shared.BOOL) {
                        const responseBody = {
                            "status": 200,
                            "userId": data.Item.userId.S,
                            "contentType": data.Item.contentType.S,
                            "contentUrl": data.Item.contentUrl.S + '/' + contentId
                        };
                        resolve({
                            statusCode: 200,
                            headers: responseHeader,
                            body: JSON.stringify(responseBody)
                        });
                    } else {
                        const responseBody = {
                            "status": 400,
                            "message": "contentId : " + contentId + " Is not shared.",
                            "requestId": requestId
                        };
                        resolve({
                            statusCode: 200,
                            headers: responseHeader,
                            body: JSON.stringify(responseBody)
                        });
                    }
                }
            });
        } catch (err) {
            errorHandler(err);
        }
    });
}
