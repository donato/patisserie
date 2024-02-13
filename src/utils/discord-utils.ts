
export function getChannel(channels: any, name: string) {
  return channels.find((channel: any) => {
    return channel.name.indexOf(name) !== -1;
  });
}


export function extractDiscordId(text: string) {
  if (text == null) {
    return false;
  }
  const matches = text.match(/\<\@(\d+)\>/);
  // const matches = text.match(/\<\@\!(\d+)\>/);
  if (!matches || matches.length != 2) {
    return false;
  }
  return matches[1];
}
