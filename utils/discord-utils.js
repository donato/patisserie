
function getChannel(channels, name) {
  return channels.find(channel => {
    return channel.name.indexOf(name) !== -1;
  });
}

function extractDiscordId(text) {
  return text.match(/\<\@\!(\d+)\>/)[1];
}

module.exports = {
  extractDiscordId,
  getChannel
};