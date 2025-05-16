import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; //
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import SearchSidebar from '../components/SearchSideBar';
import { FaCopy } from 'react-icons/fa';

const ChatRoom = () => {

  const { roomId, inviteCode } = useParams();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");


  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isComposingRef = useRef(false);

  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });


  const [showNotification, setShowModal] = useState(false);
  const [showUrlCopiedModal, setShowUrlCopiedModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  const navigate = useNavigate();           // ← 네비게이트 훅
  const location = useLocation();           // ← 현재 URL 가져오기
  const joinedOnceRef = useRef(false);

  // 참가 완료 여부
  const [setJoined] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  //임창인(채팅방 나가기)
  const handleLeaveRoom = async () => {
    if (!window.confirm('정말 이 채팅방을 나가시겠습니까?')) return;

    try {
      const res = await fetch(`http://localhost:8080/chat-rooms/${roomId}/leave`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        alert('채팅방에서 나갔습니다.');
        navigate('/');
      } else {
        const text = await res.text();
        throw new Error(text || '나가기 실패');
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setMenuOpen(false); // 닫기
    }
  };


  useEffect(() => {
    if (joinedOnceRef.current) return;   // 이미 한 번 호출됐다면 스킵
    joinedOnceRef.current = true;

    const checkAndJoin = async () => {
      try {
        const res = await fetch('http://localhost:8080/chat-rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',                    // ← 세션(cookie) 포함
          body: JSON.stringify({ inviteCode })
        });

        if (res.status === 401) {
          const data = await res.json();
          console.log("[DEBUG] 401 응답 data:", data);
          const redirectPath = `/chat/${data.details.roomId}/${data.details.inviteCode}`;
          navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`);
          return;
        }

        if (!res.ok) {
          const text = await res.text(); // 응답 본문도 확인
          console.error("[DEBUG] 실패 상태:", res.status, text);
          throw new Error('채팅방 입장 실패');
        }


        // join 성공 → DB에 참가자 저장됨
        setJoined(true);
      } catch (err) {
        console.error(err);

      }
    };
    checkAndJoin();
  }, [inviteCode, location.pathname, navigate, setJoined]);



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
      setTimeout(() => setShowUrlCopiedModal(false), 2000);
    } catch (err) {
      console.error(err);
      alert('초대 URL 복사 중 오류가 발생했습니다.');
    }
    setContextMenuVisible(false);  // 메뉴 닫기
  };


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

    // WebSocket 연결 설정
    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = Stomp.over(socket);


    stompClient.connect({}, () => {
      console.log('Connected to WebSocket');
      stompClient.subscribe(`/topic/chat/${roomId}`, (message) => {
        const received = JSON.parse(message.body);
        setMessages((prev) => [...prev, received]);
      });
    });

    // 채팅방의 메시지 초기화
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:8080/chat/messages/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data); // 메시지 데이터를 상태에 설정
        } else {
          console.error("Failed to fetch messages.");
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages(); // 컴포넌트 마운트 시 메시지 가져오기

    stompClientRef.current = stompClient;

    return () => {
      stompClient.disconnect();
      console.log('Disconnected');
    };
  }, [roomId]);

  // 메시지가 업데이트될 때마다 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const sendMessage = (text = content) => {
    const trimmed = text.trim();
    if (stompClientRef.current && trimmed !== '') {
      const chatMessage = {
        content: trimmed,
        type: inputMode,
        ...(inputMode === 'CODE' && { language })
      };
      stompClientRef.current.send(`/chat/send-message/${roomId}`, {}, JSON.stringify(chatMessage));
      setContent('');
      setInputMode('TEXT');
    }
  };


  const handleSearch = async (keyword, page = 0) => {
    setIsSearching(true);
    setShowSearchSidebar(true);
    setSearchKeyword(keyword);
    setErrorMessage(null); // 이전 에러 메시지 초기화

    try {
      const response = await fetch(
        `http://localhost:8080/chat/search/${roomId}?keyword=${keyword}&page=${page}`, {
        credentials: 'include'
      }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '검색 중 알 수 없는 오류가 발생했습니다.');
      }

      const data = await response.json();
      setSearchResults(data.content);
      setCurrentPage(data.pageable.pageNumber);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) {
      console.error('Search error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // 날짜를 YYYY-MM-DD 형식으로 변환하는 함수
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
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
                {new Date(msg.sendAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
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
                {/* <div style={{ whiteSpace: 'pre-line', padding: '10px' }}>{msg.content}</div> */}
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
            ) : msg.type === 'CODE' || msg.content.startsWith('```') ? (
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
                <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
              </div>
            )}
          </div>
        </div>
      );
    });

    return result;
  };

  return (

    <div
      onContextMenu={handleContextMenu}
      style={{
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '16px' }}>
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
                onClick={copyInviteCode}
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

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '0 24px', marginTop: '8px' }}>
            {/* ... 버튼 */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              style={{
                fontSize: '20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4a5568'
              }}
            >
              ⋯
            </button>

            {/* 드롭다운 메뉴 */}
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: '32px',
                right: '0',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}>
                <button
                  onClick={handleLeaveRoom}
                  style={{
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#e53e3e'
                  }}
                >
                  채팅방 나가기
                </button>
              </div>
            )}
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