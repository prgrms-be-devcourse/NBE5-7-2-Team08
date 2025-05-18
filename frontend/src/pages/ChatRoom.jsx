import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { useParams, useNavigate } from 'react-router-dom';
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import SearchSidebar from '../components/SearchSideBar';
import { FaCopy, FaTrashAlt } from 'react-icons/fa';

const ChatRoom = () => {
  const [messages, setMessages]=useState([]);
  const[content, setContent]=useState("");
  const { roomId }=useParams();
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");

  const [currentUser, setCurrentUser] = useState(null);
  const [contextMenuId, setContextMenuId] = useState(null);

  const [editMessageId, setEditMessageId] = useState(null); // 현재 수정 중인 메시지 ID
  const [editContent, setEditContent] = useState(""); // 수정 중인 내용
  
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

  const stompClientRef = useRef(null);
  const subscriptionRef = useRef(null);
  const hasConnectedRef = useRef(false); // 실제 연결에 성공했는지 추적
  const keepAliveIntervalRef = useRef(null); // 추가

  useEffect(() => {
      if (!roomId) {
        console.error("No roomId available");
        navigate("/");
        return;
      }
      setMessages([]); //이전 채팅방 메세지 제거

      //로그인 유저 정보 가져오기
      const fetchCurrentUser = async () => {
        try {
          const res = await fetch('http://localhost:8080/user/details', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (!res.ok) {
            throw new Error('로그인 정보를 가져오지 못했습니다.');
          }
          const user = await res.json(); // { id, email, nickname, profileImg }
          setCurrentUser(user);
        } catch (error) {
          console.error('사용자 정보 요청 실패:', error);
        }
     };

      fetchCurrentUser(); // 호출

      const client = new Client({
        webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
        reconnectDelay: 1000, // 1초 후 자동 재연결

        // 💡 서버 heartbeat가 10초 주기일 때, 클라이언트는 여유 있게 15초까지 기다림
        heartbeatIncoming: 15000, // 서버로부터 최소 15초 동안 ping 없으면 끊음
        heartbeatOutgoing: 10000, // 클라이언트가 서버로 보내는 ping 주기
        debug: (str) => console.log(`[STOMP] ${str}`),

        onConnect: () => {
          console.log('✅ Connected to WebSocket');
          hasConnectedRef.current = true; //초기 연결을 구분하는 용도

          // 기존 구독 제거
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            console.log("🔁 Previous subscription cleared.");
          }

          subscriptionRef.current= client.subscribe(`/topic/chat/${roomId}`, (message) => {
            try{
              const received = JSON.parse(message.body);
              received.sendAt ||= new Date().toISOString();
              setMessages(prev =>
                prev.some(m => m.messageId === received.messageId)
                  ? prev.map(m => m.messageId === received.messageId ? received : m)
                  : [...prev, received]
              );
            } catch(e){
              console.error("📛 Failed to parse incoming message", e);
            }
          });

          // 🔄 주기적 ping (keep-alive)
          if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);

          keepAliveIntervalRef.current = setInterval(() => {
            if (client && client.connected) {
              client.publish({
                destination: '/app/ping', // 서버가 처리하지 않는 dummy topic (핸들러 없음)
                body: 'ping'
              });
              console.log("📡 Sent keep-alive ping");
            }
          }, 20000); // 20초마다 ping
        },

        onWebSocketClose: () => {
          console.warn("❌ WebSocket closed.");
          if (!hasConnectedRef.current) {
            console.warn("🔒 Initial connection failed. Possibly due to 401.");
            navigate("/login");
          } else {
            console.log("🔁 Will attempt reconnect...");
            // alert('서버와 연결이 끊어졌습니다. 재연결을 시도합니다.');
            // 토큰 검사 로직 필요
          }
        },

        onStompError: (frame) => {
          console.error("💥 STOMP error:", frame.headers['message']);
          if (frame.headers['message']?.includes('Unauthorized') || frame.body?.includes('expired')){
            navigate("/login");
          }
        }
      });

      client.activate(); // 연결 시작
      stompClientRef.current = client;

      // 최초 메세지 가져오기
      // const fetchMessages = async () => {
      //   try {
      //     // 컨트롤러 엔드포인트에 맞게 URL 수정
      //     const response = await fetch(`http://localhost:8080/${roomId}/messages`, {
      //       method: 'GET',
      //       headers: {
      //         'Content-Type': 'application/json'
      //       },
      //       credentials: 'include' // 인증 정보 포함
      //     });
          
      //     if (response.ok) {
      //       const data = await response.json();
      //       // 서버에서 받은 모든 메시지의 날짜/시간 유효성 검사
      //       const validatedData = data.map(msg => {
      //         // sendAt이 유효하지 않으면(1970년) 현재 시간으로 설정
      //         if (!msg.sendAt || new Date(msg.sendAt).getFullYear() === 1970) {
      //           return { ...msg, sendAt: new Date().toISOString() };
      //         }
      //         return msg;
      //       });
            
      //       // 메시지 시간순으로 정렬 (오래된 메시지가 위에 오도록)
      //       const sortedData = validatedData.sort((a, b) => 
      //         new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime()
      //       );
            
      //       //setMessages(sortedData);
      //     } else {
      //       console.error("Failed to fetch messages:", response.status);
      //     }
      //   } catch (error) {
      //     console.error('Error fetching messages:', error);
      //   }
      // };
  
      // fetchMessages();
  
      return () => {
        console.log("🧹 Cleaning up WebSocket...");

        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
          console.log("🔕 Stopped keep-alive ping");
        }
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
          console.log("🔌 Subscription unsubscribed.");
        }
        if (client && client.active) {
          client.deactivate().then(() => {
            console.log("🛑 Disconnected from WebSocket");
          });
        }
      };
    }, [roomId]);

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

  // 통합 메시지 전송 함수 (텍스트/코드/이미지 모두 처리)
  const sendMessage = (overrideMessage = null) => {
    const client = stompClientRef.current;
    // 연결이 끊긴 경우 재연결 시도
    if (!client.connected) {
      client.activate();
      alert('⚠️ 서버와 연결이 끊어졌습니다. 재연결을 시도합니다.');
      return;
    }

    // 기본 메시지 구조
    let baseMessage = {
      content: content,
      type: inputMode,
      sendAt: new Date().toISOString(),
      ...(inputMode === 'CODE' && { language })
    };

    // overrideMessage가 있으면 병합 (예: 이미지 메시지 전송 시)
    const message = overrideMessage ? { ...baseMessage, ...overrideMessage } : baseMessage;

    // 메시지 비어있는 경우 전송 방지
    const trimmed = String(message.content).trim();
    if (message.type !== 'IMAGE' && trimmed === '') {
      return;
    }

    client.publish({
      destination: `/chat/send-message/${roomId}`,
      body: JSON.stringify(message)
    });

    setContent('');
    setInputMode('TEXT');
  };


  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // 전송 버튼 클릭 시 호출되는 공통 핸들러 함수 (이미지 업로드 고려)
  const handleUnifiedSend = async () => {
    if (inputMode === 'IMAGE') {
      // 이미지 업로드 모드일 경우
      if (!imageFile) {
        alert("이미지를 선택하세요.");
        return;
      }

      try {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch('http://localhost:8080/send-image', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) throw new Error('이미지 업로드 실패');

        const imageId = await response.json(); // 서버에서 imageId 반환

        sendMessage({
          type: 'IMAGE',
          content: '',
          imageFileId: imageId
        });

        setImageFile(null);
      }catch(err){
        console.err("이미지 전송 실패: ",err);
      }
      setImageFile(null);
      setImagePreviewUrl(null);
    } else {
      // TEXT 또는 CODE 모드일 경우 기존 sendMessage 호출
      sendMessage();
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

  const handleEditMessage = (messageId) => {
    const client = stompClientRef.current;
    if (!client || !client.connected) {
      alert('서버에 연결되어 있지 않습니다.');
      return;
    }

    const editPayload = {
      messageId: messageId,
      content: editContent
    };

    client.publish({
      destination: `/chat/edit-message/${roomId}`,
      body: JSON.stringify(editPayload)
    });

    // 수정 모드 종료
    setEditMessageId(null);
    setEditContent('');
  };

  const handleDeleteMessage = (messageId) => {
    const client = stompClientRef.current;
    if (!client || !client.connected) {
      alert('서버에 연결되어 있지 않습니다.');
      return;
    }

    client.publish({
      destination: `/chat/delete-message/${roomId}`,
      body: messageId
    });

    setContextMenuId(null); // 메뉴 닫기
  };

  // 메시지 데이터 처리 및 날짜 구분선 추가
  const renderMessagesWithDateSeparators = () => {
    if (!messages.length) return null;
    
    const result = [];
    
    // 메시지를 순회하며 날짜별로 구분
    messages.forEach((msg, index) => {  
      result.push(
        <div key={`msg-${index}`} style={{ 
          marginBottom: '18px', 
          display: 'flex',
          alignItems: 'flex-start',
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
            : `url("http://localhost:8080/images/profile/${msg.profileImageUrl}")`,
            backgroundSize: 'cover'
          }}>
          </div>
          <div style={{ flex: 1, maxWidth: 'calc(100% - 50px)'}}>
            <div style={{ 
              display: 'flex',
              marginBottom: '6px',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
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

            {/* 점 세개 메뉴는 조건부 렌더링 */}
            {currentUser?.id === msg.senderId && !msg.deleted && msg.type !== 'GIT' && (
              <div style={{ position: 'relative'}}>
                <button
                  onClick={() =>
                    setContextMenuId(contextMenuId === msg.messageId ? null : msg.messageId)
                  }
                  style={{
                    position: 'absolute',
                    right: '0px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#94a3b8'
                  }}
                >
                  ⋯
                </button>

                {contextMenuId === msg.messageId && (
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '0',
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    padding: '6px 0',
                    minWidth: '140px'
                  }}>
                     {/* 수정 버튼은 이미지 메시지가 아닌 경우에만 표시 */}
                     {msg.type !== 'IMAGE' && (
                      <>
                        <button
                          onClick={() => {
                            setEditMessageId(msg.messageId);
                            setEditContent(msg.content);
                            setContextMenuId(null);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 16px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          메세지 수정하기
                        </button>

                        {/* 구분선 추가 */}
                        <div style={{
                          height: '1px',
                          backgroundColor: '#e2e8f0',
                          margin: '0 8px'
                        }} />
                      </>
                    )}

                    <button
                      onClick={() => {
                        const confirmed = window.confirm("정말 삭제하시겠습니까?");
                        if (confirmed) {
                          handleDeleteMessage(msg.messageId);
                        }
                        setContextMenuId(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        color: '#e53e3e',
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 본문 영역 - 수정 중인 메시지는 textarea, 나머지는 content 렌더 */}
          {editMessageId === msg.messageId ? (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => handleEditMessage(msg.messageId)}
                  style={{
                    backgroundColor: '#4a6cf7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditMessageId(null);
                    setEditContent('');
                  }}
                  style={{
                    backgroundColor: '#e2e8f0',
                    color: '#1a202c',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )
          
          :msg.deleted ? (
            <div style={{ 
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#a0aec0',
              fontStyle: 'italic'
            }}>
              삭제된 메시지입니다.
            </div>
          )
          : msg.type === 'GIT' ? (
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
            ): msg.type === 'CODE' || (msg.content && msg.content.startsWith('```')) ? (
              <div style={{ 
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}>
                <HighlightedCode 
                  content={msg.content.replace(/```/g, '')} 
                  language={msg.language || 'java'}
                />
                 {msg.edited && (
                  <span style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    color: '#a0aec0',
                    fontStyle: 'italic'
                  }}>
                    (수정됨)
                  </span>
                )}
              </div>
            ): msg.type === 'IMAGE' ? (
                <div style={{
                  maxWidth: '30%',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)'
                }}>
                  <img
                    src={`http://localhost:8080/images/chat/${msg.chatImageUrl}`}
                    alt="업로드된 이미지"
                    style={{
                      width: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain',
                      borderRadius: '6px'
                    }}
                  />
                </div>
            )
            : (
              <div style={{ 
                fontSize: '14px',
                lineHeight: '1.5',
                color: '#4a5568',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
                {msg.edited && (
                  <span style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    color: '#a0aec0',
                    fontStyle: 'italic'
                  }}>
                    (수정됨)
                  </span>
                )}
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
                    const nextMode = inputMode === 'IMAGE' ? 'TEXT' : 'IMAGE';
                    setInputMode(nextMode);

                    // 모드가 IMAGE로 바뀌었으면 파일 선택창 자동 오픈
                    if (nextMode === 'IMAGE' && fileInputRef.current) {
                      fileInputRef.current.click();
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
                    const nextMode = inputMode === 'CODE' ? 'TEXT' : 'CODE';
                    setInputMode(nextMode);
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* 썸네일 미리보기 이미지 */}
                {inputMode === 'IMAGE' && imagePreviewUrl && (
                  <div style={{
                    position: 'relative',
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    maxWidth: '10%',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    display: 'inline-block'
                  }}>
                    <img
                      src={imagePreviewUrl}
                      alt="미리보기"
                      style={{
                        maxWidth: '100%',
                        objectFit: 'contain',
                        borderRadius: '6px',
                        display: 'block'
                      }}
                    />

                      <button
                        onClick={() => {
                          setImageFile(null);
                          setImagePreviewUrl(null);
                          setInputMode('TEXT');

                          if (fileInputRef.current) {
                           fileInputRef.current.value = null;
                          }
                        }}
                          title="삭제"
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            color: '#e53e3e',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                          }}
                      >
                         <FaTrashAlt color="#e53e3e" size={16} />
                      </button>
                    </div>
                )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <textarea
                  disabled={inputMode === 'IMAGE'}
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
                  placeholder={ inputMode === 'CODE'? '코드를 입력하세요.' : inputMode === 'IMAGE' ? '이미지를 업로드 해주세요.' : '메시지를 입력하세요.'}
                  style={{
                    flex: 1,
                    height: '80px',
                    resize: 'none',
                    padding: '12px 16px',
                    fontSize: '14px',
                    backgroundColor: inputMode === 'IMAGE' ? '#f1f5f9': inputMode === 'CODE' ? '#f8fafc' : 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    lineHeight: '1.5',
                    color: '#4a5568',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'border-color 0.2s',
                    cursor: inputMode === 'IMAGE' ? 'not-allowed' : 'text'
                  }}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  // accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];    
                      setImageFile(file);

                      // 파일 URL 생성
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreviewUrl(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display: 'none' }} // 숨김
                  />

                <button
                  // onClick={() => sendMessage()}
                  onClick={handleUnifiedSend}
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