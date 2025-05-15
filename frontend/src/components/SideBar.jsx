
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaChevronRight, 
  FaUser, 
  FaCrown, 
  FaComments, 
  FaRegCommentDots, 
  FaPlus, 
  FaAngleLeft, 
  FaAngleRight,
  FaInfoCircle,
  FaTimes,
  FaLink,
  FaGithub,
  FaCopy,
  FaExclamationCircle
} from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // 채팅방 정보 모달 상태
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  // 토스트 알림 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 사이드바 참조를 위한 ref
  const sidebarRef = React.useRef(null);

  useEffect(() => {
    fetchChatRooms(currentPage);
  }, [currentPage]);

  const fetchChatRooms = async (page) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8080/chat-rooms?page=${page}&size=10`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) throw new Error('채팅방 목록을 가져오지 못했습니다.');
      const data = await res.json();
      
      // 백엔드 응답 형식에 맞게 데이터 처리
      const validatedRooms = (data.content || []).map(room => {
        const id = room.roomId || room.id;
        return { ...room, uniqueId: id };
      }).filter(room => room.uniqueId);
      
      setChatRooms(validatedRooms);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) {
      console.error('채팅방 목록 로딩 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToRoom = (id) => {
    if (id) {
      navigate(`/chat/${id}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      alert('방 이름을 입력해주세요.');
      return;
    }
    
    try {
      const res = await fetch('http://localhost:8080/chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: roomName, repositoryUrl: repoUrl })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '채팅방 생성에 실패했습니다.');
      }
      
      const created = await res.json();
      setShowCreateModal(false);
      setRoomName('');
      setRepoUrl('');
      
      if (created?.id) {
        navigate(`/chat/${created.id}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      alert('초대 코드를 입력해주세요.');
      return;
    }
    
    try {
      const res = await fetch('http://localhost:8080/chat-rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '방 입장에 실패했습니다.');
      }
      
      const { id: roomId } = await res.json();
      setShowJoinModal(false);
      setInviteCode('');
      
      if (roomId) {
        navigate(`/chat/${roomId}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // 페이지 변경 핸들러
  const paginate = (pageNumber) => {
    if (pageNumber >= 0 && pageNumber < totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // 멤버 정보 모달 표시 핸들러
  const showMembersInfo = (room) => {
    setSelectedRoom(room);
    setShowMembersModal(true);
  };

  // 초대 코드 복사 기능
  const copyInviteCode = () => {
    if (selectedRoom?.inviteCode) {
      navigator.clipboard.writeText(selectedRoom.inviteCode)
        .then(() => {
          showToastMessage('초대 코드가 클립보드에 복사되었습니다.');
        })
        .catch(err => {
          console.error('클립보드 복사 실패:', err);
        });
    }
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 현재 페이지의 시작 항목과 끝 항목 계산
  const startItem = currentPage * 10 + 1;
  const endItem = Math.min((currentPage * 10) + chatRooms.length, totalElements);

  return (
    <>
      <div 
        ref={sidebarRef}
        className="sidebar-container" 
        style={{ 
          width: '260px', 
          height: '100%', 
          backgroundColor: '#2588F1', 
          color: 'white', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 15px 15px',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), transparent)'
        }}>
          <h3 style={{ margin: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Code Chat < br/> Rooms</span>
            {totalElements > 0 && (
              <span style={{ 
                fontSize: '14px', 
                color: 'rgba(255,255,255,0.8)', 
                padding: '2px 8px', 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                borderRadius: '12px',
                whiteSpace: 'nowrap' // Prevents line breaks
              }}>
                {startItem}-{endItem} / {totalElements}
              </span>
            )}
          </h3>
        </div>

        {/* 채팅방 목록 */}
        <div className="rooms-container" style={{ 
          overflowY: 'auto', 
          flex: 1,
          padding: '5px 0'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.7)' }}>
              채팅방 불러오는 중...
            </div>
          ) : chatRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.7)' }}>
              참여중인 채팅방이 없습니다
            </div>
          ) : (
            chatRooms.map((room) => {
              const roomUniqueId = room.uniqueId;
              const isCurrentRoom = roomId && Number(roomId) === Number(roomUniqueId);
              const isSelectedForModal = selectedRoom && Number(selectedRoom.uniqueId) === Number(roomUniqueId) && showMembersModal;
              
              return (
                <div key={`room-${roomUniqueId}`} style={{ padding: '5px 10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isCurrentRoom ? 'rgba(255,255,255,0.2)' : 'transparent',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      border: isCurrentRoom ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentRoom) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrentRoom) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div
                      onClick={() => navigateToRoom(roomUniqueId)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        flex: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        backgroundColor: isCurrentRoom ? '#fff' : 'rgba(255,255,255,0.7)',
                        color: '#2588F1',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                      }}>
                        <FaRegCommentDots size={14} />
                      </div>
                      <span style={{ 
                        fontWeight: isCurrentRoom ? 'bold' : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {room.name || room.roomName || `Room ${roomUniqueId}`}
                      </span>
                    </div>

                    <div 
                      onClick={() => showMembersInfo(room)}
                      style={{ 
                        cursor: 'pointer',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        backgroundColor: isSelectedForModal ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelectedForModal ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
                      }}
                    >
                      <FaInfoCircle size={14} />
                      {isSelectedForModal && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#fff',
                          borderRadius: '50%',
                          boxShadow: '0 0 0 2px #2588F1'
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 페이지네이션 컨트롤 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '12px 0',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(0,0,0,0.05)'
        }}>
          <button 
            onClick={() => paginate(currentPage - 1)} 
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: 'none',
              color: currentPage === 0 ? 'rgba(255,255,255,0.3)' : 'white',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              padding: '0 8px'
            }}
          >
            <FaAngleLeft />
          </button>
          
          <div style={{ margin: '0 10px', fontSize: '14px', fontWeight: '500' }}>
            {currentPage + 1} / {totalPages || 1}
          </div>
          
          <button 
            onClick={() => paginate(currentPage + 1)} 
            disabled={currentPage === totalPages - 1 || totalPages === 0}
            style={{
              background: 'none',
              border: 'none',
              color: (currentPage === totalPages - 1 || totalPages === 0) ? 'rgba(255,255,255,0.3)' : 'white',
              cursor: (currentPage === totalPages - 1 || totalPages === 0) ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              padding: '0 8px'
            }}
          >
            <FaAngleRight />
          </button>
        </div>

        {/* 하단 버튼 */}
        <div style={{ 
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(0,0,0,0.05)'
        }}>
          <button
            onClick={() => setShowJoinModal(true)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <FaComments style={{ marginRight: '8px' }} />
            Join Chat Room
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1366d6',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0d5bca';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1366d6';
            }}
          >
            <FaPlus style={{ marginRight: '8px' }} />
            New Chat Room
          </button>
        </div>
      </div>

      {/* 채팅방 정보 모달 - 사이드바 옆에 표시 */}
      {showMembersModal && selectedRoom && (
        <>
          <div className="modal-backdrop" 
            onClick={() => setShowMembersModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 990
            }}
          />

          <div style={{
            position: 'fixed', 
            top: '50%',
            left: sidebarRef.current ? `calc(${sidebarRef.current.offsetWidth}px + 20px)` : '280px',
            transform: 'translateY(-50%)',
            width: '320px',
            maxHeight: '80vh',
            backgroundColor: 'white', 
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)', 
            zIndex: 1000,
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#2588F1',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaInfoCircle size={16} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>채팅방 정보</span>
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>
                    {selectedRoom.name || selectedRoom.roomName || `Room ${selectedRoom.uniqueId}`}
                  </span>
                </div>
              </h3>
              <button 
                onClick={() => setShowMembersModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white'
                }}
              >
                <FaTimes size={16} />
              </button>
            </div>
            
            <div style={{ padding: '16px', maxHeight: 'calc(80vh - 60px)', overflowY: 'auto' }}>
              {/* 레포지토리 정보 */}
              {selectedRoom.repositoryUrl && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f7f9fc',
                  border: '1px solid #e1e8ed',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>GitHub Repository</div>
                  <a 
                    href={selectedRoom.repositoryUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#0366d6',
                      textDecoration: 'none',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      wordBreak: 'break-all'
                    }}
                  >
                    <FaGithub />
                    {selectedRoom.repositoryUrl}
                  </a>
                </div>
              )}
              
              {/* 초대 코드 */}
              {selectedRoom.inviteCode && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>초대 코드</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      flex: 1,
                      backgroundColor: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}>
                      {selectedRoom.inviteCode}
                    </div>
                    <button
                      onClick={copyInviteCode}
                      style={{
                        marginLeft: '8px',
                        backgroundColor: '#e9ecef',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px',
                        cursor: 'pointer'
                      }}
                      title="초대 코드 복사"
                    >
                      <FaCopy size={14} color="#495057" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* 멤버 리스트 */}
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                채팅방 멤버 {Array.isArray(selectedRoom.participants) && (
                  <span>({selectedRoom.participants.length}명)</span>
                )}
              </div>
              
              {Array.isArray(selectedRoom.participants) && selectedRoom.participants.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* 방장 */}
                  {selectedRoom.participants.find(p => p.owner) && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255, 215, 0, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 215, 0, 0.2)'
                    }}>
                      <div style={{
                        backgroundColor: '#fff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        border: '2px solid #FFD700'
                      }}>
                        <FaCrown style={{ color: '#FFD700' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {selectedRoom.participants.find(p => p.owner)?.nickname || '알 수 없음'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          <span style={{
                            backgroundColor: 'rgba(255, 215, 0, 0.2)',
                            color: '#856404',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            방장
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 일반 멤버 */}
                  {selectedRoom.participants.filter(p => !p.owner).map((p, idx) => (
                    <div key={`member-${idx}`} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef',
                    }}>
                      <div style={{
                        backgroundColor: '#e9ecef',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px'
                      }}>
                        <FaUser style={{ color: '#6c757d' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>
                          {p.nickname || '알 수 없음'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          <span style={{
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            멤버
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  color: '#6c757d',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  fontSize: '14px'
                }}>
                  멤버 정보를 불러올 수 없습니다
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 채팅방 생성 모달 */}
      {showCreateModal && (
        <>
          <div className="modal-backdrop" 
            onClick={() => setShowCreateModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 990
            }}
          />
          <div style={{
            position: 'fixed', 
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            backgroundColor: 'white', 
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)', 
            zIndex: 1000,
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#2588F1',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>새 채팅방 생성</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white'
                }}
              >
                <FaTimes size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label 
                  htmlFor="roomName" 
                  style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '500',
                    fontSize: '14px',
                    color: '#333' 
                  }}
                >
                  채팅방 이름 <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <input
                  id="roomName"
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="채팅방 이름을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="repoUrl" 
                  style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '500',
                    fontSize: '14px',
                    color: '#333'
                  }}
                >
                  GitHub 레포지토리 URL <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <div style={{ 
  display: 'flex', 
  alignItems: 'center',
  width: '100%',
  border: '1px solid #ced4da',
  borderRadius: '6px',
  overflow: 'hidden'
}}>
  <div style={{
    backgroundColor: '#f8f9fa', 
    padding: '10px 12px', 
    borderRight: '1px solid #ced4da'
  }}>
    <FaGithub size={16} color="#6c757d" />
  </div>
  <input
    id="repoUrl"
    type="text"
    value={repoUrl}
    onChange={(e) => setRepoUrl(e.target.value)}
    placeholder="https://github.com/username/repo"
    style={{
      flex: 1,
      padding: '10px 12px',
      border: 'none',
      fontSize: '14px',
      outline: 'none'
    }}
  />
</div>
<div style={{ fontSize: '12px', color: '#6c757d', marginTop: '6px' }}>
  <FaInfoCircle size={12} style={{ marginRight: '4px' }} />
  코드 질문/답변을 위한 GitHub 저장소 URL을 입력하세요
</div>
</div>

<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
  <button
    type="button"
    onClick={() => setShowCreateModal(false)}
    style={{
      padding: '10px 16px',
      borderRadius: '6px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #ced4da',
      cursor: 'pointer',
      fontSize: '14px',
      color: '#495057'
    }}
  >
    취소
  </button>
  <button
    type="submit"
    style={{
      padding: '10px 16px',
      borderRadius: '6px',
      backgroundColor: '#2588F1',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      color: 'white'
    }}
  >
    생성하기
  </button>
</div>
</form>
</div>
</>
)}

{/* 채팅방 참여 모달 */}
{showJoinModal && (
  <>
    <div className="modal-backdrop" 
      onClick={() => setShowJoinModal(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 990
      }}
    />
    <div style={{
      position: 'fixed', 
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      backgroundColor: 'white', 
      boxShadow: '0 5px 15px rgba(0,0,0,0.2)', 
      zIndex: 1000,
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2588F1',
        color: 'white'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>채팅방 참여하기</h3>
        <button 
          onClick={() => setShowJoinModal(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'white'
          }}
        >
          <FaTimes size={18} />
        </button>
      </div>
      
      <form onSubmit={handleJoin} style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label 
            htmlFor="inviteCode" 
            style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500',
              fontSize: '14px',
              color: '#333' 
            }}
          >
            초대 코드 <span style={{ color: '#dc3545' }}>*</span>
          </label>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            width: '100%',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: '#f8f9fa', 
              padding: '10px 12px', 
              borderRight: '1px solid #ced4da'
            }}>
              <FaLink size={16} color="#6c757d" />
            </div>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="초대 코드를 입력하세요"
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                fontSize: '14px',
                outline: 'none'
              }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setShowJoinModal(false)}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ced4da',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#495057'
            }}
          >
            취소
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              backgroundColor: '#2588F1',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white'
            }}
          >
            참여하기
          </button>
        </div>
      </form>
    </div>
  </>
)}

{/* 토스트 알림 */}
{showToast && (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '14px',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}>
    <FaExclamationCircle size={16} />
    {toastMessage}
  </div>
)}
</>
);
};

export default Sidebar;