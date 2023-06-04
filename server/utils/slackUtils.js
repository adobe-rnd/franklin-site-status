const postErrorMessage = async (say, error) => {
  await say(`:nuclear-warning: Oops! Something went wrong: ${error.message}`);
  console.error(error);
};

const sendMessageBlocks = async (say, textSections, additionalBlocks = []) => {
  let blocks = textSections.map(section => {
    let block = {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": section.text
      }
    };

    if (section.accessory) {
      block.accessory = section.accessory;
    }

    return block;
  });

  if (additionalBlocks.length > 0) {
    blocks = blocks.concat(additionalBlocks);
  }

  await say({ blocks });
};

module.exports = {
  postErrorMessage,
  sendMessageBlocks,
};
