import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaChevronRight, FaChevronDown, FaUser, FaCrown, FaComments, FaRegCommentDots, FaPlus } from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // 채팅방 목록 가져오기
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
        setChatRooms(data);
        
        // 현재 열려있는 채팅방이 있으면 확장
        if (roomId) {
          setExpandedRoom(Number(roomId));
        }
      } catch (err) {
        console.error('채팅방 목록 로딩 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatRooms();
  }, [roomId]);

  const toggleRoom = (id) => {
    setExpandedRoom(prev => prev === id ? null : id);
    navigate(`/chat/${id}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8080/chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: roomName, repositoryUrl: repoUrl })
      });
      if (!res.ok) throw new Error('채팅방 생성에 실패했습니다.');
      const created = await res.json();
      setShowCreateModal(false);
      setRoomName('');
      setRepoUrl('');
      navigate(`/chat/${created.id}`);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8080/chat-rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode })
      });
      if (!res.ok) throw new Error('방 입장에 실패했습니다.');
      const { id: roomId } = await res.json();
      navigate(`/chat/${roomId}`);
      setShowJoinModal(false);
      setInviteCode('');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <>
      <div style={{ width: '200px', height: '100%', justifyContent: 'space-between', backgroundColor: '#2588F1', color: 'white', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div>
          <h3 style={{ marginTop: '20px', marginBottom: '20px', marginLeft: '10px' }}>Chat Rooms</h3>
          
          {loading ? (
            <div style={{ padding: '10px', textAlign: 'center' }}>로딩 중...</div>
          ) : chatRooms.length === 0 ? (
            <div style={{ padding: '10px', textAlign: 'center' }}>채팅방이 없습니다</div>
          ) : (
            chatRooms.map(room => (
              <div key={room.id} style={{ padding: '10px' }}>
                <div
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    backgroundColor: Number(roomId) === room.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    padding: '5px',
                    borderRadius: '4px'
                  }}
                  onClick={() => toggleRoom(room.id)}
                >
                  <FaRegCommentDots style={{ marginRight: '8px' }} />
                  <span style={{ flex: 1 }}>{room.name}</span>
                  {expandedRoom === room.id ? <FaChevronDown /> : <FaChevronRight />}
                </div>

                {expandedRoom === room.id && (
                  <div style={{ paddingLeft: '20px', marginTop: '5px' }}>
                    {/* 방장 표시 */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '5px', 
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#FFD700'
                      }}
                    >
                      <FaCrown style={{ marginRight: '6px' }} />
                      {room.owner?.nickname || '알 수 없음'}
                    </div>
                    
                    {/* 참가자 목록 */}
                    {room.participants && room.participants
                      .filter(p => !room.owner || p.id !== room.owner.id) // 방장 제외
                      .map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', fontSize: '14px' }}>
                          <FaUser style={{ marginRight: '6px' }} />
                          {p.nickname || '알 수 없음'}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            style={{
              width: '90%',
              marginTop: '20px',
              padding: '10px',
              backgroundColor: '#2377FF',
              color: 'white',
              border: '1px solid #5AAAFF',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
            onClick={() => setShowJoinModal(true)}
          >
            <FaComments style={{ marginRight: '8px' }} />
            Join Chat Room
          </button>

          <button
            style={{
              width: '90%',
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#2377FF',
              color: 'white',
              border: '1px solid #5AAAFF',
              cursor: 'pointer',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
            onClick={() => setShowCreateModal(true)}
          >
            <FaPlus style={{ marginRight: '8px' }} />
            New Chat Room
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              width: '320px',
              boxSizing: 'border-box'
            }}
          >
            <h2 style={{ margin: '0 0 16px' }}>채팅방 생성</h2>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="방 이름"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '12px', boxSizing: 'border-box' }}
                required
              />
              <input
                type="url"
                placeholder="레포지토리 URL"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '12px', boxSizing: 'border-box' }}
                required
              />
              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '6px 12px',
                    background: '#eee',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    marginLeft: '8px',
                    background: '#2588F1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              width: '320px',
              boxSizing: 'border-box'
            }}
          >
            <h2 style={{ margin: '0 0 16px' }}>채팅방 참가</h2>
            <form onSubmit={handleJoin}>
              <input
                type="text"
                placeholder="초대 코드 입력"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '12px', boxSizing: 'border-box' }}
                required
              />
              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  style={{
                    padding: '6px 12px',
                    background: '#eee',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    marginLeft: '8px',
                    background: '#2588F1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  입장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;