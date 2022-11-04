const amqp = require("amqplib/callback_api");
const { exec } = require("child_process");

require("dotenv").config();

const pipelineHost = process.env.PIPELINE_HOST;
const pipelineUser = process.env.PIPELINE_USER;
const pipelinePass = process.env.PIPELINE_PASS;

const options = {
  credentials: require("amqplib").credentials.plain(pipelineUser, pipelinePass),
};

amqp.connect(pipelineHost, options, (connectionError, connection) => {
  if (connectionError) {
    console.log("error connecting to host");
  } else {
    connection.createChannel((channelError, channel) => {
      if (channelError) {
        console.log("error creating a channel");
      } else {
        console.log("successfully connected and created a channel");

        const queue = "dukatech";

        channel.assertQueue(queue, {
          durable: false,
        });

        console.log("Listening for commit activity to registry...", queue);

        channel.consume(
          queue,
          (msg) => {
            let commit = msg.content.toString();
            if (commit === "New commit") {
              // Send back a message confirming a new deployment has begun
              const message = "Starting a new deployment...";
              channel.sendToQueue(queue, Buffer.from(message));
              console.log(message);
              console.log("Starting directory: " + process.cwd());
              try {
                process.chdir("/home/azureuser/Shop-Okoa-Developer-Portal");
                console.log("New directory: " + process.cwd());
              } catch (err) {
                console.log("chdir: " + err);
              }
              // Start to pull new code
              exec("git pull", (error, stdout) => {
                const gitPullStart = "Starting to pull new code with git...";
                channel.sendToQueue(queue, Buffer.from(gitPullStart));
                console.log(gitPullStart);
                if (error) {
                  const gitPullError =
                    "There was an error pulling new code with git";
                  channel.sendToQueue(queue, Buffer.from(gitPullError));
                  console.log(gitPullError);
                  return;
                }
                if (stdout) {
                  const gitPullSuccess =
                    "Successfully pulled new code with git";
                  channel.sendToQueue(queue, Buffer.from(gitPullSuccess));
                  console.log(gitPullSuccess);
                  // Start to install node modules
                  exec("npm install", (error, stdout) => {
                    const nodeModulesInstallStart =
                      "Starting to install node modules...";
                    channel.sendToQueue(
                      queue,
                      Buffer.from(nodeModulesInstallStart)
                    );
                    console.log(nodeModulesInstallStart);
                    if (error) {
                      const nodeModulesInstallError =
                        "There was an error installing node modules";
                      channel.sendToQueue(
                        queue,
                        Buffer.from(nodeModulesInstallError)
                      );
                      console.log(nodeModulesInstallError);
                      return;
                    }
                    if (stdout) {
                      const nodeModulesInstallSuccess =
                        "Successfully installed node modules";
                      channel.sendToQueue(
                        queue,
                        Buffer.from(nodeModulesInstallSuccess)
                      );
                      console.log(nodeModulesInstallSuccess);
                      // Start to build app
                      exec("npm run build", (error, stdout) => {
                        const appBuildStart = "Starting to build the app...";
                        channel.sendToQueue(queue, Buffer.from(appBuildStart));
                        console.log(appBuildStart);
                        if (error) {
                          const appBuildError =
                            "There was an error building the app";
                          channel.sendToQueue(
                            queue,
                            Buffer.from(appBuildError)
                          );
                          console.log(appBuildError);
                          return;
                        }
                        if (stdout) {
                          const appBuildSuccess =
                            "Successfully built and served the app";
                          channel.sendToQueue(
                            queue,
                            Buffer.from(appBuildSuccess)
                          );
                          console.log(appBuildSuccess);
                        }
                      });
                    }
                  });
                }
              });
            }
          },
          {
            noAck: true,
          }
        );
      }
    });
  }
});
