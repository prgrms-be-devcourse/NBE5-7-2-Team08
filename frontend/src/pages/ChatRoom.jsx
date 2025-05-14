import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useParams } from 'react-router-dom'
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';

const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const { roomId, inviteCode } = useParams();

  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });


  const [showModal, setShowModal] = useState(false);
  const [showUrlCopiedModal, setShowUrlCopiedModal] = useState(false); // 우클릭 초대 URL 복사용
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 }); // 모달 위치 저장

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuVisible(true);
    setContextMenuPosition({ x: e.pageX, y: e.pageY });
  };

  useEffect(() => {
    const handleClick = () => setContextMenuVisible(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  //임창인(초대 코드만 복사 join chat room으로 입장해야함)
  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode); // 백엔드 없이 바로 복사
      setShowModal(true);
      setTimeout(() => setShowModal(false), 2000);
    } catch (err) {
      console.error(err);
      alert('초대 코드 복사 중 오류가 발생했습니다.');
    }
  };

  //공유용 전체 url 복사
  const copyInviteUrl = async () => {  // 변경: 전체 URL 복사
    try {
      const fullUrl = `${window.location.origin}/chat/${roomId}/${inviteCode}`;
      await navigator.clipboard.writeText(fullUrl);
      setModalPosition(contextMenuPosition);
      setShowUrlCopiedModal(true);
      setTimeout(() => setShowModal(false), 2000);
    } catch (err) {
      console.error(err);
      alert('초대 URL 복사 중 오류가 발생했습니다.');
    }
    setContextMenuVisible(false);  // 메뉴 닫기
  };





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

    <div onContextMenu={handleContextMenu} style={{ backgroundColor: '#e0e0e0', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Top Bar */}
      <Header></Header>

      {/* 본문 전체 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />

        {/* Chat area */}
        <div style={{
          flex: 1,
          width: '700px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
        }}>

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

            {/* 초대 URL 복사 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#fff',
                  color: '#2588F1',
                  border: '1px solid #5AAAFF',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={copyInviteCode}
              >
                초대 코드 복사
              </button>
            </div>

            {messages.map((msg, index) => (
              <div key={index} style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
                {/*프로필 이미지 출력*/}
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#7ec8e3',
                  marginRight: '10px'
                }}>
                </div>
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
                  height: '30px',
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



      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenuVisible && (
        <div
          style={{
            position: 'absolute',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000
          }}
        >
          <button
            onClick={copyInviteUrl}
            style={{
              display: 'block',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            공유 초대 링크 복사
          </button>
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: '15px',
          right: '15px',
          backgroundColor: '#333',
          color: '#fff',
          padding: '10px 16px',
          borderRadius: '6px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000
        }}>
          초대 코드가 복사되었습니다
        </div>
      )}

      {showUrlCopiedModal && (
        <div style={{
          position: 'absolute',
          top: modalPosition.y,
          left: modalPosition.x,
          transform: 'translateY(-100%)', // 모달이 클릭 위치 위로 뜨도록
          backgroundColor: '#333',
          color: 'white',
          padding: '10px 16px',
          borderRadius: '6px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 2000
        }}>
         공유 초대 링크가 복사되었습니다
        </div>
      )}



    </div>
  );
};

export default ChatRoom;


