import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaChevronRight, FaChevronDown, FaUser, FaCrown, FaComments, FaRegCommentDots, FaPlus } from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [expandedRoomId, setExpandedRoomId] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const fetchChatRooms = async () => {
      try {
        const res = await fetch('http://localhost:8080/chat-rooms', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        if (!res.ok) throw new Error('채팅방 목록을 가져오지 못했습니다.');
        const data = await res.json();
        
        // Ensure all room objects have valid IDs
        const validatedRooms = (data.content || []).map(room => {
          const id = room.id || room.roomId;
          return { ...room, uniqueId: id };
        }).filter(room => room.uniqueId); // Filter out any rooms without IDs
        
        setChatRooms(validatedRooms);
        
        // Set expanded room if there's a current roomId
        if (roomId) {
          setExpandedRoomId(roomId);
        }
      } catch (err) {
        console.error('채팅방 목록 로딩 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatRooms();
  }, [roomId]);

  const toggleExpand = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedRoomId(prev => (prev === id ? null : id));
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

  return (
    <>
      <div className="sidebar-container" style={{ 
        width: '260px', 
        height: '100%', 
        backgroundColor: '#2588F1', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}>
        <div>
          <h3 style={{ margin: '20px 0 20px 15px' }}>Chat Rooms</h3>

          <div className="rooms-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '10px' }}>로딩 중...</div>
            ) : chatRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px' }}>채팅방이 없습니다</div>
            ) : (
              chatRooms.map((room) => {
                // Generate a guaranteed unique key for each room
                const roomUniqueId = room.uniqueId;
                const isCurrentRoom = roomId && Number(roomId) === Number(roomUniqueId);
                const isExpanded = expandedRoomId === String(roomUniqueId);
                
                return (
                  <div key={`room-${roomUniqueId}`} style={{ padding: '5px 10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isCurrentRoom ? 'rgba(255,255,255,0.2)' : 'transparent',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        marginBottom: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      <div
                        onClick={() => navigateToRoom(roomUniqueId)}
                        style={{ display: 'flex', alignItems: 'center', flex: 1 }}
                      >
                        <FaRegCommentDots style={{ marginRight: '10px' }} />
                        <span style={{ fontWeight: isCurrentRoom ? 'bold' : 'normal' }}>
                          {room.name || room.roomName || `Room ${roomUniqueId}`}
                        </span>
                        {isCurrentRoom && (
                          <span style={{
                            marginLeft: '10px',
                            fontSize: '12px',
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            padding: '2px 6px',
                            borderRadius: '10px'
                          }}>
                            현재
                          </span>
                        )}
                      </div>

                      <div 
                        onClick={(e) => toggleExpand(e, String(roomUniqueId))}
                        style={{ cursor: 'pointer' }}
                      >
                        {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        padding: '10px',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        borderRadius: '5px',
                        marginLeft: '5px',
                        borderLeft: '3px solid rgba(255,255,255,0.3)'
                      }}>
                        <div style={{ marginBottom: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                          채팅방 멤버
                        </div>
                        
                        {Array.isArray(room.participants) && room.participants.length > 0 ? (
                          <>
                            {room.participants.find(p => p.owner) && (
                              <div key={`owner-${roomUniqueId}`} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                color: '#FFD700', 
                                marginBottom: '8px' 
                              }}>
                                <FaCrown style={{ marginRight: '8px' }} />
                                {room.participants.find(p => p.owner)?.nickname || '알 수 없음'}
                              </div>
                            )}
                            
                            {room.participants.filter(p => !p.owner).map((p, idx) => (
                              <div key={`participant-${roomUniqueId}-${idx}`} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                fontSize: '14px', 
                                marginBottom: '5px' 
                              }}>
                                <FaUser style={{ marginRight: '8px', color: 'rgba(255,255,255,0.7)' }} />
                                {p.nickname || '알 수 없음'}
                              </div>
                            ))}
                          </>
                        ) : (
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                            멤버 정보를 불러올 수 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ padding: '15px' }}>
          <button
            onClick={() => setShowJoinModal(true)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#2377FF',
              border: '1px solid #5AAAFF',
              borderRadius: '4px',
              color: 'white',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              cursor: 'pointer'
            }}
          >
            <FaComments style={{ marginRight: '8px' }} />
            Join Chat Room
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#2377FF',
              border: '1px solid #5AAAFF',
              borderRadius: '4px',
              color: 'white',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <FaPlus style={{ marginRight: '8px' }} />
            New Chat Room
          </button>
        </div>
      </div>

      {showCreateModal && (
        <Modal
          title="채팅방 생성"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        >
          <input
            type="text"
            placeholder="방 이름"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
          <input
            type="url"
            placeholder="레포지토리 URL"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </Modal>
      )}

      {showJoinModal && (
        <Modal
          title="채팅방 참가"
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoin}
        >
          <input
            type="text"
            placeholder="초대 코드 입력"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </Modal>
      )}
    </>
  );
};

const Modal = ({ title, onClose, onSubmit, children }) => (
  <div style={{
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100vw', 
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)', 
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'center', 
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: 'white', 
      padding: '24px', 
      borderRadius: '8px',
      width: '320px', 
      boxSizing: 'border-box',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0',
        color: '#333',
        fontSize: '18px'
      }}>
        {title}
      </h2>
      <form onSubmit={onSubmit}>
        {children}
        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', 
              background: '#eee',
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            취소
          </button>
          <button
            type="submit"
            style={{
              padding: '8px 16px', 
              marginLeft: '8px', 
              background: '#2588F1',
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            확인
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default Sidebar;