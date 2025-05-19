import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaRegCommentDots,
  FaInfoCircle,
  FaAngleLeft, 
  FaAngleRight,
  FaComments,
  FaPlus
} from 'react-icons/fa';

import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import RoomInfoModal from './modals/RoomInfoModal';
import Toast from './common/Toast';

const Sidebar = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const sidebarRef = useRef(null);
  
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  // 토스트 알림 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 현재 사용자 정보 
  const [currentUser, setCurrentUser] = useState(null);


  useEffect(() => {
    fetchChatRooms(currentPage);
  }, [currentPage]);

  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    try {
      const userRes = await fetch('http://localhost:8080/users/current', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      }
    } catch (err) {
      console.error('사용자 정보 로딩 오류:', err);
    }
  };

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

  // 페이지 변경 핸들러
  const paginate = (pageNumber) => {
    if (pageNumber >= 0 && pageNumber < totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // 방 상세 정보 가져오기
  const fetchRoomDetails = async (roomId) => {
    try {
      // 방 상세 정보를 가져오는 API가 있다면 사용
      // 현재 예시에서는 이런 API가 명시되어 있지 않으므로 기존 목록에서 찾아서 사용
      const existingRoom = chatRooms.find(room => Number(room.uniqueId) === Number(roomId));
      
      if (!existingRoom) return null;
      
      // 방장 정보가 없는 경우에만 추가
      if (!existingRoom.participants || !existingRoom.participants.some(p => p.owner)) {
        return {
          ...existingRoom,
          participants: currentUser ? [
            {
              ...currentUser,
              owner: existingRoom.ownerId === currentUser.id,
              nickname: currentUser.nickname || currentUser.username || '나'
            },
            ...(existingRoom.participants || []).filter(p => p.id !== currentUser.id)
          ] : existingRoom.participants || []
        };
      }
      
      return existingRoom;
    } catch (err) {
      console.error('방 상세 정보 가져오기 오류:', err);
      return null;
    }
  };

  // 멤버 정보 모달 표시 핸들러
  const showMembersInfo = async (room) => {
    // 방 상세 정보 가져오기
    const detailedRoom = await fetchRoomDetails(room.uniqueId);
    
    // 방 정보에 방장 추가
    const enhancedRoom = detailedRoom || room;
    
    // 방장 정보 처리
    if (currentUser && enhancedRoom.ownerId === currentUser.id && 
        (!enhancedRoom.participants || !enhancedRoom.participants.some(p => p.owner))) {
      enhancedRoom.participants = enhancedRoom.participants || [];
      
      // 이미 해당 사용자가 목록에 있는지 확인
      const existingUserIndex = enhancedRoom.participants.findIndex(p => p.id === currentUser.id);
      
      if (existingUserIndex >= 0) {
        // 기존 사용자 정보를 방장으로 업데이트
        enhancedRoom.participants[existingUserIndex] = {
          ...enhancedRoom.participants[existingUserIndex],
          owner: true
        };
      } else {
        // 방장 정보 추가
        enhancedRoom.participants.push({
          ...currentUser,
          owner: true,
          nickname: currentUser.nickname || currentUser.username || '나'
        });
      }
    }
    
    setSelectedRoom(enhancedRoom);
    setShowMembersModal(true);
    
    // 상태 업데이트 - 방 목록에 반영
    setChatRooms(prev => prev.map(r => 
      Number(r.uniqueId) === Number(enhancedRoom.uniqueId) ? enhancedRoom : r
    ));
  };

  // 토스트 메시지 표시 함수
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 채팅방 생성 핸들러
  const handleCreateRoom = async (roomName, repoUrl) => {
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
      fetchChatRooms(0);
      
      // 응답에서 얻은 데이터로 채팅방 목록 직접 업데이트
      if (created) {
        // 생성자를 방장으로 추가
        const newRoom = {
          ...created,
          uniqueId: created.id || created.roomId,
          ownerId: created.ownerId || (currentUser ? currentUser.id : null),
          participants: [
            {
              ...(currentUser || {}),
              owner: true,
              nickname: currentUser?.nickname || currentUser?.username || '나'
            }
          ]
        };
        
        // 현재 페이지가 첫 페이지인 경우만 직접 목록에 추가
        if (currentPage === 0) {
          setChatRooms(prev => [newRoom, ...prev.slice(0, 9)]); // 최대 10개 유지
          setTotalElements(prev => prev + 1);
        } else {
          // 첫 페이지가 아니면 첫 페이지로 이동하고 목록 갱신
          setCurrentPage(0);
          setCurrentPage(0);
          fetchChatRooms(0);
        }
      }
      
      if (created?.id) {
        navigate(`/chat/${created.id}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // 채팅방 참여 핸들러
  const handleJoinRoom = async (inviteCode) => {
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

      const joined = await res.json();
      setShowJoinModal(false);
      setCurrentPage(0);
      fetchChatRooms(0);

      if (joined) {
        const newRoom = {
        ...joined,
        uniqueId: joined.id || joined.roomId,
        participants: [
          ...(joined.participants || []),
          ...(joined.ownerId === currentUser?.id && currentUser
            ? [{
                ...currentUser,
                owner: true,
                nickname: currentUser.nickname || currentUser.username || '나'
              }]
            : []
          )
        ]
      };

        if (currentPage === 0) {
          setChatRooms(prev => {
            const exists = prev.some(room => room.uniqueId === newRoom.uniqueId);
            if (!exists) {
              return [newRoom, ...prev.slice(0, 9)];
            }
            return prev;
          });
          setTotalElements(prev => prev + 1);
        } else {
          setCurrentPage(0);
          fetchChatRooms(0);
        }
      }

      if (joined?.id) {
        navigate(`/chat/${joined.id}`);
      }
    } catch (err) {
      alert(err.message);
    }
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
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Code Chat <br/> Rooms</span>
            {totalElements > 0 && (
              <span style={{ 
                fontSize: '14px', 
                color: 'rgba(255,255,255,0.8)', 
                padding: '2px 8px', 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                borderRadius: '12px',
                whiteSpace: 'nowrap'
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

      {/* 모달 컴포넌트들 */}
      {showMembersModal && selectedRoom && (
        <RoomInfoModal 
          room={selectedRoom}
          onClose={() => setShowMembersModal(false)}
          sidebarRef={sidebarRef}
          showToast={showToastMessage}
        />
      )}

      {showCreateModal && (
        <CreateRoomModal 
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRoom}
        />
      )}

      {showJoinModal && (
        <JoinRoomModal 
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoinRoom}
        />
      )}

      {showToast && (
        <Toast message={toastMessage} />
      )}
    </>
  );
};

export default Sidebar;
