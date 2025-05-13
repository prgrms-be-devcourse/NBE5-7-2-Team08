import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useParams } from 'react-router-dom'
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import SearchSidebar from '../components/SearchSideBar';

const ChatRoom = () => {
  const [messages, setMessages]=useState([]);
  const[content, setContent]=useState("");
  const { roomId }=useParams();
  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [showSearchSidebar, setShowSearchSidebar] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null); // 선언 추가

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

const handleSearch = async (keyword, page = 0) => {
  setIsSearching(true);
  setShowSearchSidebar(true);
  setSearchKeyword(keyword);
  setErrorMessage(null); // 이전 에러 메시지 초기화

  try {
    const response = await fetch(
      `http://localhost:8080/chat/${roomId}/search?keyword=${keyword}&page=${page}`
    );

    if (!response.ok) {
      const errorData = await response.json(); // 👈 에러 응답 파싱
      throw new Error(errorData.message || '검색 중 알 수 없는 오류가 발생했습니다.');
    }

    const data = await response.json();
    setSearchResults(data.content);
    setCurrentPage(data.pageable.pageNumber);
    setTotalPages(data.totalPages);
    setTotalElements(data.totalElements);
  } catch (err) {
    console.error('Search error:', err);
    setErrorMessage(err.message); // 👈 백엔드에서 내려준 메시지를 표시
  } finally {
    setIsSearching(false);
  }
};

  // 버튼 스타일 공통화
  const buttonStyle = {
    backgroundColor: '#4a6cf7',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0 20px',
    height: '40px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  };

  // 입력 필드 스타일 공통화
  const inputStyle = {
    fontSize: '14px',
    padding: '10px 14px',
    border: '1px solid #e0e4e8',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
  };

  return (
    <div style={{ 
      backgroundColor: '#f5f7fa', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>

      {/* Top Bar */}
      <Header></Header>

      {/* 본문 전체 영역 */}
      <div style={{ flex:1, display: 'flex', overflow: 'hidden', padding: '16px' }}>
        <Sidebar />

        {/* Chat area */}
        <div style={{
          flex: 1,
          width: '700px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}>
          
          {/* 채팅방 헤더 - 상단에 고정 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid #eaedf0',
            backgroundColor: '#fff'
          }}>
            <div style={{ 
              fontWeight: '600', 
              fontSize: '18px',
              color: '#2d3748'
            }}>
              채팅방 #{roomId}
            </div>
            <div>
              <input
                type="text"
                placeholder="메시지 검색"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.target.value);
                  }
                }}
                style={{
                  ...inputStyle,
                  width: '220px',
                  backgroundColor: '#f9fafc',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* 메시지 목록 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            backgroundColor: '#fff',
            minHeight: 0
          }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ 
                marginBottom: '18px', 
                display: 'flex',
                alignItems: 'flex-start'
              }}>
                {/* 프로필 이미지 */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#4a6cf7',
                  marginRight: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ flex: 1, maxWidth: 'calc(100% - 50px)' }}>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'baseline',
                    marginBottom: '6px'
                  }}>
                    <span style={{ 
                      fontWeight: '600',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
                      {msg.senderName}
                    </span>
                    <span style={{ 
                      fontWeight: 'normal', 
                      fontSize: '12px', 
                      color: '#718096', 
                      marginLeft: '8px' 
                    }}>
                      {new Date(msg.sendAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.type === 'CODE' || msg.content.startsWith('```') ? (
                    <div style={{ 
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0'
                    }}>
                      <HighlightedCode 
                        content={msg.content.replace(/```/g, '')} 
                        language={msg.language || 'java'} 
                      />
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: '#4a5568',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 메시지 입력 폼 */}
          <div style={{
            backgroundColor: '#fbfbfd',
            borderTop: '1px solid #eaedf0',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                display: 'flex',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                padding: '2px',
                marginRight: '12px'
              }}>
                <span
                  onClick={() => {
                    if (inputMode === 'IMAGE') {
                      setInputMode('TEXT');
                    } else {
                      setInputMode('IMAGE');
                    }
                  }}
                  style={{ 
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer', 
                    fontWeight: '500',
                    fontSize: '13px',
                    backgroundColor: inputMode === 'IMAGE' ? '#ffffff' : 'transparent',
                    color: inputMode === 'IMAGE' ? '#4a6cf7' : '#64748b',
                    boxShadow: inputMode === 'IMAGE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  사진
                </span>
                <span
                  onClick={() => {
                    if (inputMode === 'CODE') {
                      setInputMode('TEXT');
                      setContent('');
                    } else {
                      setInputMode('CODE');
                    }
                  }}
                  style={{ 
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px',
                    backgroundColor: inputMode === 'CODE' ? '#ffffff' : 'transparent',
                    color: inputMode === 'CODE' ? '#4a6cf7' : '#64748b',
                    boxShadow: inputMode === 'CODE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  코드
                </span>
              </div>
              
              {/* 언어 선택 옵션을 코드 버튼 바로 옆으로 이동 */}
              {inputMode === 'CODE' && (
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ 
                    ...inputStyle,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '13px',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <textarea
                value={content}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // 줄바꿈 막기
                    sendMessage();      // 메시지 전송
                  }
                }}
                placeholder={inputMode === 'CODE' ? "코드를 입력하세요..." : "메시지를 입력하세요..."}
                style={{
                  flex: 1,
                  // 입력창 높이 증가 - 이전: 40px
                  height: '80px',
                  resize: 'none',
                  padding: '12px 16px',
                  fontSize: '14px',
                  backgroundColor: inputMode === 'CODE' ? '#f8fafc' : 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  lineHeight: '1.5',
                  color: '#4a5568',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.2s'
                }}
              />

              <button
                onClick={sendMessage}
                style={{
                  ...buttonStyle,
                  // 버튼 높이도 입력창에 맞게 조정
                  height: '80px'
                }}
              >
                전송
              </button>
            </div>
          </div>
        </div>
        
        {showSearchSidebar && (
          <SearchSidebar
            searchKeyword={searchKeyword}
            searchResults={searchResults}
            isSearching={isSearching}
            errorMessage={errorMessage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            onClose={() => setShowSearchSidebar(false)}
            onPageChange={(page) => handleSearch(searchKeyword, page)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatRoom;