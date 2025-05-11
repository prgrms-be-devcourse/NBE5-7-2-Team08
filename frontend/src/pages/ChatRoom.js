import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useParams } from 'react-router-dom'
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';

const ChatRoom = () => {
  const [messages, setMessages]=useState([]);
  const[content, setContent]=useState("");
  const { roomId }=useParams();
  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const HighlightedCode = ({ content, language }) => {
    return (
      <Highlight className={language}>{content}</Highlight>
    );
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setContent(val);
    if (val.startsWith("```")) {
      setInputMode("CODE");
      setContent('');
    }
  };

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = Stomp.over(socket);

    stompClient.connect({}, () => {
      console.log('Connected to WebSocket');

      stompClient.subscribe(`/topic/chat/${roomId}`, (message) => {
        const received = JSON.parse(message.body);
        setMessages(prev => [...prev, received]);
      });

      stompClientRef.current = stompClient;
    });

    return () => {
      stompClient.disconnect();
      console.log('Disconnected');
    };
  }, [roomId]);

  // 메시지가 업데이트될 때마다 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (stompClientRef.current && content.trim() !== '') {
      const chatMessage = {
        content,
        type: inputMode,
        ...(inputMode === 'CODE' && { language }) // CODE일 경우에만 language 추가
      };
      stompClientRef.current.send(`/chat/send-message/${roomId}`, {}, JSON.stringify(chatMessage));
      setContent('');
      setInputMode('TEXT'); //초기화
    }
  };

  return (
    <div style={{ backgroundColor: '#e0e0e0', height: '100vh', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>

      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
        {/* 방 생성 & 참가 그룹 */}
        <div style={{ display: 'flex', gap: '10px', marginRight: '20px' }}>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#888',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/create'}
          >
            방 생성
          </button>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#aaa',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/join'}
          >
            방 참가
          </button>
        </div>

        {/* 로그아웃 & 마이페이지 그룹 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#eee',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/logout'}
          >
            로그아웃
          </button>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#f5f5f5',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/mypage'}
          >
            마이페이지
          </button>
        </div>
      </div>

      {/* 본문 전체 영역 */}
      <div style={{ flex:1, display: 'flex', overflow: 'hidden'}}>
        {/* Sidebar */}
        <div style={{ width: '200px', padding: '10px', backgroundColor: '#ffffff' }}>
          <h3 style={{ color: 'black', fontWeight: 'bold' }}>채팅방 목록</h3>
          <div style={{ backgroundColor: '#2c2f7e', color: 'white', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
            {/* <p style={{ margin: 0 }}>{roomName}</p> 채팅방 조회 로직 필요*/}
            <p style={{ margin: 0 }}>핸고8</p>
          </div>
        </div>

        {/* Chat area */}
        <div style={{
          flex: 1,
          marginLeft: '20px',
          width: '700px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
        }}>

          {/* 방 제목 + 드롭다운 */}
          {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h2>{roomName}</h2>
            <button
              onClick={() => setShowParticipants(prev => !prev)}
              style={{ padding: '5px 10px', fontSize: '14px' }}
            >
              참여자 ▼
            </button>
          </div> */}

          {/* 참여자 목록 (토글) */}
          {/* {showParticipants && (
            <div style={{ marginBottom: '10px', paddingLeft: '10px' }}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {participants.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )} */}

          {/* 메시지 목록 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#fff',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            marginBottom: '15px',
            minHeight: 0
          }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#7ec8e3',
                  marginRight: '10px'
                }}></div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {msg.senderName}
                    <span style={{ fontWeight: 'normal', fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                      {new Date(msg.sendAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.type === 'CODE' || msg.content.startsWith('```') ? (
                    <HighlightedCode content={msg.content.replace(/```/g, '')} language={msg.language || 'java'} />
                ) : (
                  <div>{msg.content}</div>
                )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 메시지 입력 폼 */}
          <div style={{
            backgroundColor: '#d3d3d3',
            border: '1px solid black',
            borderRadius: '3px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '5px' }}>
              {/* <span style={{ marginRight: '10px' }}>사진</span>
              <span>코드</span> */}

            <span
              onClick={() => {
                if (inputMode === 'IMAGE') {
                  setInputMode('TEXT');
                } else {
                  setInputMode('IMAGE');
                }
              }}
              style={{ marginRight: '10px', cursor: 'pointer', fontWeight: inputMode === 'IMAGE' ? 'bold' : 'normal' }}
            >사진</span>
            <span
              onClick={() => {
                if (inputMode === 'CODE') {
                  setInputMode('TEXT');
                  setContent('');
                } else {
                  setInputMode('CODE');
                  // setContent('```\n```');
                }
              }}
              style={{ cursor: 'pointer', fontWeight: inputMode === 'CODE' ? 'bold' : 'normal' }}
            >코드</span>
            {inputMode === 'CODE' && (
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ marginLeft: '10px' }}
              >
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="python">Python</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
              </select>
            )}
            </div>
            
            <div style={{ display: 'flex' }}>
              <textarea
                value={content}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // 줄바꿈 막기
                    sendMessage();      // 메시지 전송
                  }
                }}
                placeholder={inputMode === 'CODE' ? "코드를 입력하세요." : "메시지를 입력하세요."}
                style={{
                  flex: 1,
                  height: '50px',
                  resize: 'none',
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: inputMode === 'CODE' ? '#F1F3F4' : 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              />

              <button
                onClick={sendMessage}
                style={{
                  backgroundColor: '#2c2f7e',
                  color: 'white',
                  padding: '15px 20px',
                  border: 'none',
                  fontSize: '16px'
                }}
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;