import React from 'react';

const BlankRoom = () => {

  return (
    <div style={{ backgroundColor: '#e0e0e0', height: '100vh', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>

      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
        {/* 방 생성 & 참가 그룹 */}
        <div style={{ display: 'flex', gap: '10px', marginRight: '20px' }}>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#888',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/create'}
          >
            방 생성
          </button>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#aaa',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/join'}
          >
            방 참가
          </button>
        </div>

        {/* 로그아웃 & 마이페이지 그룹 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#eee',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/logout'}
          >
            로그아웃
          </button>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#f5f5f5',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/mypage'}
          >
            마이페이지
          </button>
        </div>
      </div>

      {/* 본문 전체 영역 */}
      <div style={{ flex:1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '200px', padding: '10px', backgroundColor: '#ffffff' }}>
          <h3 style={{ color: 'black', fontWeight: 'bold' }}>채팅방 목록</h3>
          <p>현재 참여 중인 채팅방이 없습니다.</p>
        </div>

        {/* Chat area */}
        <div style={{
          flex: 1,
          marginLeft: '20px',
          width: '700px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
        }}>

        <div style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#fff',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            marginBottom: '15px',
            minHeight: 0
          }}>
          </div>

          {/* 메시지 입력 폼 */}
          <div style={{
            backgroundColor: '#d3d3d3',
            border: '1px solid black',
            borderRadius: '3px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto'
          }}>
            <div style={{ marginBottom: '5px' }}>
              <span style={{ marginRight: '10px' }}>사진</span>
              <span>코드</span>
            </div>
            <div style={{ display: 'flex' }}>
              <textarea
                style={{
                  flex: 1,
                  height: '50px',
                  resize: 'none',
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'not-allowed'
                }}
                disabled
                placeholder="채팅방에 참여해야 메시지를 보낼 수 있습니다"
              />
              <button
                disabled
                style={{
                  backgroundColor: '#2c2f7e',
                  color: 'white',
                  padding: '15px 20px',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'not-allowed'
                }}
              >
                전송
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BlankRoom;