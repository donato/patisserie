
function getChannel(channels, name) {
  return channels.find(channel => {
    return channel.name.indexOf(name) !== -1;
  });
}

function extractDiscordId(text) {
  const matches = text.match(/\<\@\!(\d+)\>/);
  if (matches.length != 2) {
    return false;
  }
  return matches[1];
}

module.exports = {
  extractDiscordId,
  getChannel
};