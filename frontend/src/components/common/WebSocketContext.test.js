import { act, render } from "@testing-library/react"
import { Client } from "@stomp/stompjs"
import { WebSocketProvider } from "./WebSocketContext"

let mockCapturedConfig
const mockClient = {
  active: false,
  reconnectDelay: undefined,
  activate: jest.fn(),
  deactivate: jest.fn(() => Promise.resolve()),
}

jest.mock("@stomp/stompjs", () => ({ Client: jest.fn() }))

jest.mock("../api/refreshManager", () => ({
  safeRefreshToken: jest.fn(() => Promise.resolve()),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockCapturedConfig = undefined
  mockClient.active = false
  mockClient.reconnectDelay = undefined
  Client.mockImplementation(function (config) {
    mockCapturedConfig = config
    mockClient.reconnectDelay = config.reconnectDelay
    return mockClient
  })
})

it("연결 성공 후에도 5초 자동 재연결을 유지한다", () => {
  render(
    <WebSocketProvider>
      <div>child</div>
    </WebSocketProvider>,
  )

  expect(mockCapturedConfig.reconnectDelay).toBe(5000)

  act(() => {
    mockCapturedConfig.onConnect()
  })

  expect(mockClient.reconnectDelay).toBe(5000)
})
