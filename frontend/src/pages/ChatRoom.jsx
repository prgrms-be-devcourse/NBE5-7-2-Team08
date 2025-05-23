import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; //
import Highlight from 'react-highlight';
import 'highlight.js/styles/github.css';
import Sidebar from '../components/SideBar';
import Header from '../components/header';
import SearchSidebar from '../components/SearchSideBar';
import { FaCopy, FaTrashAlt, FaUserPlus, FaClock } from 'react-icons/fa';
import axiosInstance from '../components/api/axiosInstance';

const ChatRoom = () => {

  const { roomId, inviteCode } = useParams();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [inputMode, setInputMode] = useState("TEXT");
  const [language, setLanguage] = useState("java");

  const [currentUser, setCurrentUser] = useState(null);
  const [contextMenuId, setContextMenuId] = useState(null);

  const [editMessageId, setEditMessageId] = useState(null); // 현재 수정 중인 메시지 ID
  const [editContent, setEditContent] = useState(""); // 수정 중인 내용

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


  //임창인
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showLeaveSuccess, setShowLeaveSuccess] = useState(false);

  const [roomName, setRoomName] = useState("로딩 중...");

  // 방 정보를 가져오는 함수 - fetchCurrentUser 함수 위나 아래에 추가
  const fetchRoomInfo = async () => {
    try {
      const res = await axiosInstance.get(`/chat-rooms/check?inviteCode=${inviteCode}`, {
      });

      const roomData = res.data;
      setRoomName(roomData.roomName || `채팅방 #${roomId}`);
    } catch (error) {
      console.error('방 정보 요청 실패:', error);
      setRoomName(`채팅방 #${roomId}`); // 오류 시 기본값으로 표시
    }
  };


  //임창인(채팅방 나가기)
  const handleLeaveRoom = async () => {
    try {
      const res = await axiosInstance.delete(`/chat-rooms/${roomId}/leave`);
      
      // 성공 처리
      setShowLeaveConfirm(false);
      setShowLeaveSuccess(true);

      setTimeout(() => {
        setShowLeaveSuccess(false);
        navigate('/');
      }, 500);
    } catch (err) {
      // 실패 처리
      const errorMsg =
        err.response?.data?.message || // 백엔드에서 보낸 메시지
        err.message ||                 // 일반 오류 메시지
        '나가기 실패';                 // 기본 메시지

      alert(errorMsg);
      console.error('채팅방 나가기 실패:', err);
    } finally {
      setMenuOpen(false);
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

    setMessages([]); // 이전 채팅방 메세지 제거

    // 로그인 유저 정보 가져오기
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('http://localhost:8080/user/details', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

    fetchCurrentUser();
    fetchRoomInfo(); // 방 정보 가져오기 함수 호출 추가

    // 메시지 초기화
    const fetchMessages = async () => {
      try {
        const res = await axiosInstance.get(`/${roomId}/messages`);
        const data = res.data;

        const validatedData = data.map(msg => {
          // 날짜 유효성 검사
          if (!msg.sendAt || new Date(msg.sendAt).getFullYear() === 1970) {
            msg = { ...msg, sendAt: new Date().toISOString() };
          }

          // isEdited와 isDeleted 속성이 undefined이면 기본값 설정
          if (msg.edited === undefined) msg.edited = !!msg.isEdited;
          if (msg.deleted === undefined) msg.deleted = !!msg.isDeleted;

          return msg;
        });

        const sortedData = validatedData.sort(
            (a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime()
        );

        setMessages(sortedData);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    // WebSocket 연결 설정
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 1000,
      heartbeatIncoming: 15000,
      heartbeatOutgoing: 10000,
      debug: (str) => console.log(`[STOMP] ${str}`),

      onConnect: () => {
        console.log('✅ Connected to WebSocket');
        hasConnectedRef.current = true;

        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          console.log("🔁 Previous subscription cleared.");
        }

        subscriptionRef.current = client.subscribe(`/topic/chat/${roomId}`, (message) => {
          try {
            const received = JSON.parse(message.body);
            received.sendAt ||= new Date().toISOString();
            
            // isEdited와 isDeleted 속성을 편집 및 삭제 상태로 변환
            if (received.isEdited !== undefined) received.edited = received.isEdited;
            if (received.isDeleted !== undefined) received.deleted = received.isDeleted;
            
            setMessages(prev =>
              prev.some(m => m.messageId === received.messageId)
                ? prev.map(m => m.messageId === received.messageId ? received : m)
                : [...prev, received]
            );
          } catch (e) {
            console.error("📛 Failed to parse incoming message", e);
          }
        });

        if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);

        keepAliveIntervalRef.current = setInterval(() => {
          if (client && client.connected) {
            client.publish({
              destination: '/app/ping',
              body: 'ping'
            });
            console.log("📡 Sent keep-alive ping");
          }
        }, 20000);
      },

      onWebSocketClose: async () => {
        try {
          const res = await fetch('http://localhost:8080/auth', {
            credentials: "include"
          });

          if (res.status === 401) {
            console.warn("세션 만료 → 로그인 페이지로 이동");
            window.location.href = '/login';
          }
        } catch (err) {
          console.warn("네트워크 오류 → 로그인 페이지로 이동", err);
          window.location.href = '/login';
        }
      },

      onStompError: (frame) => {
        console.error("💥 STOMP error:", frame.headers['message']);
        if (frame.headers['message']?.includes('Unauthorized') || frame.body?.includes('expired')) {
          navigate("/login");
        }
      }
    });

    client.activate();
    stompClientRef.current = client;

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
  }, [roomId, navigate]);

  // 메시지가 업데이트될 때마다 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // 검색 결과 이동
  const scrollToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // 깔끔한 하이라이트
      messageElement.style.backgroundColor = '#e8f4fd';
      messageElement.style.borderRadius = '6px';
      messageElement.style.transition = 'all 0.3s ease';
      
      // 2초 후 제거
      setTimeout(() => {
        messageElement.style.backgroundColor = '';
        messageElement.style.borderRadius = '';
      }, 2000);
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
    const response = await axiosInstance.get(`/chat/search/${roomId}`, {
      params: {
        keyword,
        page,
        size: 10
      }
    });

    const data = response.data;
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
      setErrorMessage(err.response?.data?.message || '검색 중 오류가 발생했습니다.');
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

  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // 전송 버튼 클릭 시 호출되는 공통 핸들러 함수 (이미지 업로드 고려)
const handleUnifiedSend = async () => {
  if (inputMode === 'IMAGE') {
    if (!imageFile) {
      alert("이미지를 선택하세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axiosInstance.post('/send-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const imageId = response.data;
      sendMessage({
        type: 'IMAGE',
        content: '',
        imageFileId: imageId
      });

      setImageFile(null);
      setImagePreviewUrl(null);
    } catch (err) {
      console.error("이미지 전송 실패: ", err);
    }
  } else {
    sendMessage();
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

      // 입장 알림 메시지 처리 (EVENT 타입)
      if (msg.type === 'EVENT') {
        result.push(
          <div key={`event-${index}`} style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '12px 0', // 상하 마진 줄임
            padding: '0 16px'
          }}>
            <div style={{
              backgroundColor: '#f0f9ff',
              borderRadius: '16px',
              padding: '8px 16px', // 패딩 줄임
              display: 'flex',
              alignItems: 'center', // 가로 정렬로 변경
              gap: '8px',
              color: '#0369a1',
              fontSize: '13px',
              fontWeight: '500',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e0f2fe',
              maxWidth: '80%'
            }}>
              {/* 유저 아이콘 */}
              <FaUserPlus size={12} style={{ flexShrink: 0 }} />
              
              {/* 메인 메시지 */}
              <span>{msg.content}</span>
              
              {/* 입장 시간 표시 (구분선과 함께) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: '#60a5fa',
                borderLeft: '1px solid #bfdbfe',
                paddingLeft: '8px',
                marginLeft: '4px'
              }}>
                <FaClock size={10} />
                {formatTime(msg.joinedAt || msg.sendAt)}
              </div>
            </div>
          </div>
        );
        return;
      }

      // 메시지 추가
      result.push(
        <div key={`msg-${index}`} 
          id={`message-${msg.messageId}`} 
          style={{
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
            backgroundImage: `url("http://localhost:8080/images/profile/${msg.profileImageUrl}")`,
            backgroundSize: 'cover'
          }}>
          </div>
          <div style={{ flex: 1, maxWidth: 'calc(100% - 50px)' }}>
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
                <div style={{ position: 'relative' }}>
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
            {editMessageId === msg.messageId && msg.type !== 'GIT' ? (
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
              :(msg.deleted || msg.isDeleted) ? (
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
                    {msg.content && (
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', padding: '10px' }}>
                        {msg.content.split('\n').map((line, i) => (
                          <div key={i}>
                            {i === 0 ? (
                              <strong>{renderWithLink(line)}</strong>
                            ) : (
                              <>{renderWithLink(line)}</>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : msg.type === 'CODE' || (msg.content && msg.content.startsWith('```')) ? (
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
                ) : msg.type === 'IMAGE' ? (
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
                      {(msg.edited || msg.isEdited) && (
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
                {roomName}
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

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '0 24px', marginRight: '20px',marginTop: '15px' }}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              style={{
                fontSize: '30px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4a5568'
              }}
            >
               ⋮
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
                  onClick={() => setShowLeaveConfirm(true)}
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
                    placeholder={inputMode === 'CODE' ? '코드를 입력하세요.' : inputMode === 'IMAGE' ? '이미지를 업로드 해주세요.' : '메시지를 입력하세요.'}
                    style={{
                      flex: 1,
                      height: '80px',
                      resize: 'none',
                      padding: '12px 16px',
                      fontSize: '14px',
                      backgroundColor: inputMode === 'IMAGE' ? '#f1f5f9' : inputMode === 'CODE' ? '#f8fafc' : 'white',
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


          {/* 나가기 확인 모달 */}
          {showLeaveConfirm && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 2000
            }}>
              <div style={{
                backgroundColor: 'white', padding: '24px', borderRadius: '8px',
                minWidth: '280px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                <p style={{ fontSize: '16px', marginBottom: '20px' }}>
                  정말 이 채팅방을 나가시겠습니까?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    style={{
                      padding: '8px 16px', backgroundColor: '#eee',
                      border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleLeaveRoom}
                    style={{
                      padding: '8px 16px', backgroundColor: '#e53e3e', color: 'white',
                      border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}
                  >
                    나가기
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* 나가기 완료 모달 */}
          {showLeaveSuccess && (
            <div style={{
              position: 'fixed', top: '20px', right: '20px',
              backgroundColor: '#333', color: 'white',
              padding: '12px 20px', borderRadius: '6px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)', zIndex: 2000
            }}>
              채팅방에서 나갔습니다.
            </div>
          )}
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
            onMessageClick={scrollToMessage}
          />
        )}
      </div>
    </div>
  );
};
export default ChatRoom;
