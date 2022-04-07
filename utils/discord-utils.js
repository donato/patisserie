
function getChannel(channels, name) {
  return channels.find(channel => {
    return channel.name.indexOf(name) !== -1;
  });
}

module.exports = {
  getChannel
};