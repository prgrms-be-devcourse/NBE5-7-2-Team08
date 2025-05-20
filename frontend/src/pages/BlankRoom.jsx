import SideBar from '../components/SideBar';
import Header from '../components/header';
import sleepingCat from '../sleeping_cat.gif';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const BlankRoom = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');

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
        navigate(`/chat/${created.id}/${created.inviteCode}`);
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
    
    const data = await res.json();
    setShowJoinModal(false);
    setInviteCode('');
    
    navigate(`/chat/${data.id}/${data.inviteCode}`);

  } catch (err) {
    alert(err.message);
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

  return (
    <div style={{ backgroundColor: '#e0e0e0', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>
      <Header></Header>

      {/* 본문 영역 */}
      <div style={{ flex:1, display: 'flex', overflow: 'hidden' }}>
        <SideBar />
      
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img src={sleepingCat} alt="졸고 있는 고양이" style={{ width: '350px' }}></img>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', marginBottom: '20px' }}>
              Let's start coding with DevChat!
            </h2>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px'}}>
              
              <button
                style={{ ...buttonStyle, backgroundColor: '#2c2f7e' }}
                onClick={() => setShowJoinModal(true)}
              >
                🔗 Join Chat Room
              </button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#6c757d' }}
                onClick={() => setShowCreateModal(true)}
              >
                ➕ New Chat Room
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
        </div>
      </div>
    </div>
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

export default BlankRoom;