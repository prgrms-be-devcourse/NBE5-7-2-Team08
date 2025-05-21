import SideBar from '../components/SideBar';
import Header from '../components/header';
import sleepingCat from '../sleeping_cat.gif';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import JoinRoomModal from '../components/modals/JoinRoomModal';
import axiosInstance from '../components/api/axiosInstance';

const BlankRoom = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // 채팅방 생성 핸들러
  const handleCreateRoom = async (roomName, repoUrl) => {
    try {
      const res = await axiosInstance.post('http://localhost:8080/chat-rooms', {
        name: roomName,
        repositoryUrl: repoUrl
      });

      const created = res.data;
      setShowCreateModal(false);

      if (created?.id) {
        navigate(`/chat/${created.id}/${created.inviteCode}`);
      }
    } catch (err) {
      const backendMessage = err.response?.data?.message;

      alert(
        backendMessage ||            // 백엔드에서 내려준 메시지
             // JS 오류 메시지
        '방 생성에 실패했습니다.'    // 기본 메시지
      );
    }
  };


  // 채팅방 참여 핸들러
   const handleJoinRoom = async (inviteCode) => {
    try {
      const res = await axiosInstance.post('/chat-rooms/join', {
        inviteCode
      });
      
      const data = res.data;
      setShowJoinModal(false);
      
      navigate(`/chat/${data.id}/${data.inviteCode}`);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "방 입장에 실패했습니다.");
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

          {/* 분리된 모달 컴포넌트 사용 */}
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
        </div>
      </div>
    </div>
  );
};

export default BlankRoom;