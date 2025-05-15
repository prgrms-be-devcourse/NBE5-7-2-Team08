import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import SearchSidebar from '../components/SearchSideBar';
import { FaCopy } from 'react-icons/fa';

const ChatRoom = () => {
  const [messages, setMessages]=useState([]);
  const[content, setContent]=useState("");
  const { roomId }=useParams();
  const navigate = useNavigate(); // Added navigate hook
  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isComposingRef = useRef(false);
  
  // 초대 코드 관련 상태 추가
  const [showNotification, setShowNotification] = useState(false);

  const [showSearchSidebar, setShowSearchSidebar] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  const HighlightedCode = ({ content, language }) => {
    return (
      <Highlight className={language}>{content}</Highlight>
    );
  };

  const renderWithLink = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0366d6', textDecoration: 'underline' }}
        >
          {part}
        </a>
      ) : (
        part
      )
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
      // Make sure roomId exists before connecting
      if (!roomId) {
        console.error("No roomId available");
        navigate("/"); // Redirect to home if no room ID is found
        return;
      }
    
      // WebSocket 연결 설정
      const socket = new SockJS('http://localhost:8080/ws');
      const stompClient = Stomp.over(socket);
  
      stompClient.connect({}, () => {
        console.log('Connected to WebSocket');
        stompClient.subscribe(`/topic/chat/${roomId}`, (message) => {
          const received = JSON.parse(message.body);
          // 수신된 메시지의 sendAt이 유효한지 확인하고, 아니면 현재 시간으로 설정
          if (!received.sendAt || new Date(received.sendAt).getFullYear() === 1970) {
            received.sendAt = new Date().toISOString();
          }
          setMessages((prev) => [...prev, received]);
        });
      });
  
      // 채팅방의 메시지 초기화
      const fetchMessages = async () => {
        try {
          // 컨트롤러 엔드포인트에 맞게 URL 수정
          const response = await fetch(`http://localhost:8080/${roomId}/messages`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include' // 인증 정보 포함
          });
          
          if (response.ok) {
            const data = await response.json();
            // 서버에서 받은 모든 메시지의 날짜/시간 유효성 검사
            const validatedData = data.map(msg => {
              // sendAt이 유효하지 않으면(1970년) 현재 시간으로 설정
              if (!msg.sendAt || new Date(msg.sendAt).getFullYear() === 1970) {
                return { ...msg, sendAt: new Date().toISOString() };
              }
              return msg;
            });
            
            // 메시지 시간순으로 정렬 (오래된 메시지가 위에 오도록)
            const sortedData = validatedData.sort((a, b) => 
              new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime()
            );
            
            setMessages(sortedData);
          } else {
            console.error("Failed to fetch messages:", response.status);
          }
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
  
      fetchMessages(); // 컴포넌트 마운트 시 메시지 가져오기
  
      stompClientRef.current = stompClient;
  
      return () => {
        if (stompClientRef.current) {
          stompClientRef.current.disconnect();
          console.log('Disconnected');
        }
      };
    }, [roomId, navigate]);

  // 메시지가 업데이트될 때마다 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 초대 코드 복사 기능 추가
  const copyInviteUrl = async () => {
    if (!roomId) return; // roomId가 없는 경우 실행하지 않음
    
    try {
      const res = await fetch(`http://localhost:8080/chat-rooms/invite/${roomId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('초대 URL을 가져오지 못했습니다.');
      const { inviteUrl } = await res.json();
      await navigator.clipboard.writeText(inviteUrl);
      setShowNotification(true); // 알림 표시
      setTimeout(() => setShowNotification(false), 2000); // 2초 뒤 닫기
    } catch (err) {
      console.error(err);
      alert('초대 URL 복사 중 오류가 발생했습니다.');
    }
  };

  const sendMessage = (text = content) => {
    const trimmed = text.trim();
    if (stompClientRef.current && trimmed !== '') {
      const chatMessage = {
        content: trimmed,
        type: inputMode,
        // 현재 시간을 ISO 형식으로 설정 (백엔드에서 덮어쓸 수도 있지만 프론트에서도 설정)
        sendAt: new Date().toISOString(),
        ...(inputMode === 'CODE' && { language })
      };
      stompClientRef.current.send(`/chat/send-message/${roomId}`, {}, JSON.stringify(chatMessage));
      setContent('');
      setInputMode('TEXT');
    }
  };

  const handleSearch = async (keyword, page = 0) => {
    // Check if roomId is defined before proceeding
    if (!roomId) {
      setErrorMessage('채팅방 ID가 유효하지 않습니다.');
      return;
    }

    setIsSearching(true);
    setShowSearchSidebar(true);
    setSearchKeyword(keyword);
    setErrorMessage(null); // 이전 에러 메시지 초기화

    try {
      // 백엔드 API 엔드포인트 수정 - 작동하는 URL 패턴으로 변경
      const response = await fetch(
        `http://localhost:8080/chat/search/${roomId}?keyword=${keyword}&page=${page}&size=20`,
        {
          // Add credentials to include cookies for authentication
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Handle non-OK responses
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('로그인이 필요합니다. 인증 후 다시 시도해주세요.');
        } else if (response.status === 404) {
          throw new Error('검색 API 경로를 찾을 수 없습니다. 백엔드 API 주소를 확인해주세요.');
        } 
        
        // Safely try to parse error response
        let errorData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (e) {
            throw new Error(`서버 오류 (${response.status}): JSON 응답을 파싱할 수 없습니다.`);
          }
        } else {
          throw new Error(`서버 오류 (${response.status}): 올바른 형식의 응답이 아닙니다.`);
        }
        
        throw new Error(errorData?.message || '검색 중 알 수 없는 오류가 발생했습니다.');
      }

      // Parse successful response
      const data = await response.json();
      
      // 검색 결과도 날짜/시간 유효성 검사
      const validatedResults = (data.content || []).map(msg => {
        if (!msg.sendAt || new Date(msg.sendAt).getFullYear() === 1970) {
          return { ...msg, sendAt: new Date().toISOString() };
        }
        return msg;
      });
      
      setSearchResults(validatedResults);
      setCurrentPage(data.pageable?.pageNumber || 0);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Search error:', err);
      setErrorMessage(err.message || '검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 날짜를 YYYY-MM-DD 형식으로 변환하는 함수 (수정됨)
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // 유효한 날짜인지 확인 (1970년은 유효하지 않은 것으로 간주)
      if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
        return new Date().toLocaleDateString('ko-KR', {
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit'
        });
      }
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
      });
    } catch (error) {
      console.error('날짜 형식 변환 오류:', error);
      return new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
      });
    }
  };

  // 시간을 HH:MM 형식으로 변환하는 함수 (수정됨)
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
        return new Date().toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true  // 오전/오후 표시 활성화
        });
      }
      
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true  // 오전/오후 표시 활성화
      });
    } catch (error) {
      console.error('시간 형식 변환 오류:', error);
      return new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true  // 오전/오후 표시 활성화
      });
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

  // 메시지 데이터 처리 및 날짜 구분선 추가
  const renderMessagesWithDateSeparators = () => {
    if (!messages.length) return null;
    
    const result = [];
    let currentDate = null;
    
    // 메시지를 순회하며 날짜별로 구분
    messages.forEach((msg, index) => {
      const messageDate = formatDate(msg.sendAt);
      
      // 날짜가 바뀌었다면 구분선 추가
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        result.push(
          <div key={`date-${index}`} style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0',
            color: '#64748b',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <div style={{
              flex: '1',
              height: '1px',
              backgroundColor: '#e2e8f0'
            }}></div>
            <div style={{ 
              margin: '0 16px',
              padding: '4px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              {messageDate}
            </div>
            <div style={{
              flex: '1',
              height: '1px',
              backgroundColor: '#e2e8f0'
            }}></div>
          </div>
        );
      }
      
      // 메시지 추가
      result.push(
        <div key={`msg-${index}`} style={{ 
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
            flexShrink: 0,
            backgroundImage: msg.type === 'GIT'
            ? 'url("https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png")'
            : undefined,
            backgroundColor: msg.type === 'GIT' ? 'transparent' : '#4a6cf7',
            backgroundSize: 'cover'
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
                {formatTime(msg.sendAt)}
              </span>
            </div>
            
            {/* GitHub 메시지 UI */}
            {msg.type === 'GIT' ? (
                <div style={{
                backgroundColor: '#f6f8fa',
                borderRadius: '6px',
                color: '#24292e',
                display: 'flex'
                }}>
                {/* 왼쪽 검정색 선 */}
                <div style={{
                    width: '6px',
                    backgroundColor: '#000',
                    marginRight: '10px',
                    borderRadius: '2px'
                }} />
                <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5', padding: '10px' }}>
                    <strong style={{ display: 'block', marginBottom: '6px' }}>
                    {msg.content.split('\n')[0]}
                    </strong>
                    {msg.content.split('\n').slice(1).map((line, i) => (
                    <React.Fragment key={i}>
                        {renderWithLink(line)}
                        <br />
                    </React.Fragment>
                    ))}
                </div>
                </div>
            ): msg.type === 'CODE' || msg.content.startsWith('```') ? (
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
      );
    });
    
    return result;
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
      <div style={{ flex:1, display: 'flex', overflow: 'hidden' }}>
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
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ 
                fontWeight: '600', 
                fontSize: '18px',
                color: '#2d3748'
              }}>
                채팅방 #{roomId}
              </span>
              
              {/* 초대 코드 복사 버튼 */}
              <button
                onClick={copyInviteUrl}
                style={{
                  backgroundColor: '#2588F1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FaCopy size={14} />
                초대 코드 복사
              </button>
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
            {renderMessagesWithDateSeparators()}
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
                onCompositionStart={() => (isComposingRef.current = true)}
                onCompositionEnd={() => (isComposingRef.current = false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
                    e.preventDefault();
                    sendMessage(e.target.value);
                  }
                }}
                placeholder={inputMode === 'CODE' ? "코드를 입력하세요..." : "메시지를 입력하세요..."}
                style={{
                  flex: 1,
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

      {showNotification && (
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
          초대 코드가 복사되었습니다.
        </div>
      )}
    </div>
  );
};

export default ChatRoom;