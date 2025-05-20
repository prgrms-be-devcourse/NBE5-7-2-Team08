import React, { useState } from 'react';
import { 
  FaTimes,
  FaInfoCircle,
  FaGithub,
  FaSpinner,
  FaComments
} from 'react-icons/fa';

const CreateRoomModal = ({ onClose, onSubmit }) => {
  const [roomName, setRoomName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  // 방 정보 입력 후 확인 단계로 이동
  const handleNext = (e) => {
    e.preventDefault();
    
    if (!roomName.trim()) {
      alert('방 이름을 입력해주세요.');
      return;
    }
    
    setShowConfirmation(true);
  };

  // 최종 생성 확인
  const confirmCreate = () => {
    if (roomName.trim()) {
      setLoading(true);
      onSubmit(roomName.trim(), repoUrl.trim());
    }
  };

  // 이전 단계로 돌아가기
  const goBack = () => {
    setShowConfirmation(false);
  };

  return (
    <>
      <div className="modal-backdrop" 
        onClick={onClose}
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
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            {showConfirmation ? '채팅방 생성 확인' : '새 채팅방 생성'}
          </h3>
          <button 
            onClick={onClose}
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
        
        {/* 방 정보 확인 화면 */}
        {showConfirmation ? (
          <div style={{ padding: '20px' }}>
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '12px',
                fontSize: '15px',
                color: '#333'
              }}>
                생성할 채팅방 정보:
              </div>
              <div style={{
                backgroundColor: '#e9ecef',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '15px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#6c757d', 
                    display: 'block', 
                    marginBottom: '3px' 
                  }}>
                    방 이름
                  </span>
                  <span style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#343a40',
                    wordBreak: 'break-all'
                  }}>
                    {roomName}
                  </span>
                </div>
                {repoUrl && (
                  <div>
                    <span style={{ 
                      fontSize: '13px', 
                      color: '#6c757d', 
                      display: 'block', 
                      marginBottom: '3px' 
                    }}>
                      GitHub 레포지토리
                    </span>
                    <span style={{ 
                      fontSize: '14px', 
                      color: '#495057',
                      wordBreak: 'break-all'
                    }}>
                      {repoUrl}
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                color: '#0d6efd',
                fontWeight: '500'
              }}>
                <FaComments style={{ marginRight: '8px' }} />
                <span>이 채팅방을 생성하시겠습니까?</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #ced4da',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  color: '#495057'
                }}
              >
                이전으로
              </button>
              <button
                type="button"
                onClick={confirmCreate}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#2588F1',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? (
                  <>
                    <FaSpinner 
                      size={14} 
                      style={{ 
                        marginRight: '8px',
                        animation: 'spin 1s linear infinite'
                      }} 
                    />
                    생성 중...
                  </>
                ) : (
                  '생성하기'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* 방 정보 입력 화면 */
          <form onSubmit={handleNext} style={{ padding: '20px' }}>
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
                GitHub 레포지토리 URL
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
                onClick={onClose}
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
                다음
              </button>
            </div>
          </form>
        )}
        
        {/* 스피너 애니메이션 */}
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </>
  );
};

export default CreateRoomModal;