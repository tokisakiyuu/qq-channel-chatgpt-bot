import { createOpenAPI, createWebsocket, Config } from 'qq-guild-bot'
import { ask, onChatClose, onChatOpen } from './chat'

const botConfig: Config = {
  appID: process.env.APP_ID as string,
  token: process.env.TOKEN as string,
  sandbox: (process.env.SANDBOX as string) === '1'
}

const client = createOpenAPI(botConfig)
const ws = createWebsocket(botConfig) as any

const sayContentReg = new RegExp('^<.*> \/([a-zA-z0-9]+) (.*)$')

// 消息监听
ws.on('GUILD_MESSAGES', (data: any) => {
  const { eventType, msg } = data
  if (eventType !== 'MESSAGE_CREATE') return
  const { channel_id, author } = msg
  const userID: string = author.id
  const content: string = msg.content
  const matched = content.match(sayContentReg)
  if (!matched) return
  if (matched.length !== 3) return
  const [ _, command, phrase ] = matched
  if (command !== 'say') return
  ask(`${channel_id}_${userID}`, phrase)
    .then(answer => {
      client.messageApi.postMessage(channel_id, { content: `<@${userID}>${answer}` })
    })
    .catch((error: Error) => {
      client.messageApi.postMessage(channel_id, { content: `<@${userID}>\n[Bot Error]\n${error.message || error}` })
    })
})

onChatClose(sessionKey => {
  const [ channel_id, userID ] = sessionKey.split('_')
  client.messageApi.postMessage(channel_id, { content: `<@${userID}>[本次对话结束]` })
})

onChatOpen(sessionKey => {
  const [ channel_id, userID ] = sessionKey.split('_')
  client.messageApi.postMessage(channel_id, { content: `<@${userID}>[对话开始]\n如果一定时间内没有发送下一条消息将自动结束对话` })
})

process.on('uncaughtException', (error) => {
  console.error(error)
})