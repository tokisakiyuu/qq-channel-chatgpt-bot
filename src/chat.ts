import { EventEmitter } from 'events'
import { Configuration, OpenAIApi } from 'openai'

const ev = new EventEmitter()
const chatSessions = new Map<string, string>()
const chatSessionsTimer = new Map<string, NodeJS.Timeout>()
const chatSessionTimeout = 10 * 60 * 1000
// const chatSessionTimeout = 30000
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY })
const openai = new OpenAIApi(openaiConfig)

function createChat(key: string, timeout: number) {
  chatSessions.set(key, `The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: Hello, who are you?\nAI: I am an AI created by OpenAI. How can I help you today?\nHuman: `)
  chatSessionsTimer.set(
    key,
    setTimeout(() => ev.emit('chat_timeout', key), timeout)
  )
}

export async function ask(sessionKey: string, content: string) {
  if (!chatSessions.has(sessionKey)) {
    createChat(sessionKey, chatSessionTimeout)
    ev.emit('chat_created', sessionKey)
  }
  const prompt = `${chatSessions.get(sessionKey)} ${content}\nAI:`
  const completion = await requestCompletion(prompt)
  chatSessions.set(sessionKey, `${prompt} ${completion}\nHuman:`)
  clearTimeout(chatSessionsTimer.get(sessionKey))
  chatSessionsTimer.set(
    sessionKey,
    setTimeout(() => ev.emit('chat_timeout', sessionKey), chatSessionTimeout)
  )
  return completion
}

export function onChatClose(callback: (key: string) => void) {
  ev.on('chat_timeout', (sessionKey: string) => {
    chatSessions.delete(sessionKey)
    clearTimeout(chatSessionsTimer.get(sessionKey))
    chatSessionsTimer.delete(sessionKey)
    callback(sessionKey)
  })
}

export function onChatOpen(callback: (key: string) => void) {
  ev.on('chat_created', callback)
}

async function requestCompletion(prompt: string) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      temperature: 0.9,
      max_tokens: 2563,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0.6,
      stop: ["\nHuman:", "\nAI:"],
    }, {
      timeout: chatSessionTimeout
    })
    const { choices } = response.data
    const [ ch ] = choices
    if (!ch) throw new Error('ChatGPT not response choices')
    return ch.text || ''
  } catch (error: any) {
    if (error.response) {
      throw new Error(`status code ${error.response.status}\n${JSON.stringify(error.response.data, null, 2)}`)
    } else {
      throw new Error(error.message)
    }
  }
}