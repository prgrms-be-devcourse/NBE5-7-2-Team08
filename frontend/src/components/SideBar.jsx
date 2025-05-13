import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaChevronDown, FaUser, FaComments, FaRegCommentDots, FaPlus } from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const [expandedRoom, setExpandedRoom] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const chatRooms = [
    { id: 1, name: '2차 프로젝트', participants: ['데브코스'] },
    { id: 4, name: '채팅 프로젝트', participants: ['지은', '창인', '문성', '강현'] }
  ];

  const toggleRoom = (id) => {
    setExpandedRoom(prev => prev === id ? null : id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8080/chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          {chatRooms.map(room => (
            <div key={room.id} style={{ padding: '10px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleRoom(room.id)}
              >
                <FaRegCommentDots style={{ marginRight: '8px' }} />
                <span style={{ flex: 1 }}>{room.name}</span>
                {expandedRoom === room.id ? <FaChevronDown /> : <FaChevronRight />}
              </div>

              {expandedRoom === room.id && (
                <div style={{ paddingLeft: '20px', marginTop: '5px' }}>
                  {room.participants.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', fontSize: '14px' }}>
                      <FaUser style={{ marginRight: '6px' }} />
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
            <h2 style={{ margin: '0 0 16px' }}>New Chat Room</h2>
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
            <h2 style={{ margin: '0 0 16px' }}>Join Chat Room</h2>
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
