
const AWS = require('aws-sdk');

exports.handler = async function (event, context) {
    return new Promise(function (resolve, reject) {
        try {
            console.log("Event");
            console.log(event);
            console.log("Context");
            console.log(context);
            const redirectUrl = "https://www.naver.com";

            const responseHeader = {
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Location": redirectUrl
            };
            const responseBody = {
            };

            resolve({
                statusCode: 307,
                headers: responseHeader,
                body: JSON.stringify(responseBody)
            });

        } catch (err) {
            console.log(err);
            resolve({
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                body: JSON.stringify(err)
            });
        }
    });
}
