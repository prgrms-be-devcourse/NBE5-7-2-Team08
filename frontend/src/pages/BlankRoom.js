import React from 'react';
import SideBar from '../fragments/SideBar';

const BlankRoom = () => {

  return (
    <div style={{ backgroundColor: '#e0e0e0', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>

      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px', marginTop: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', marginRight: '10px' }}>
          <button
            style={{
              padding: '10px 15px',
              backgroundColor: '#eee',
              color: 'black',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={async() => {
              try {
                const response = await fetch("http://localhost:8080/logout", {
                  method: "POST",
                  credentials: "include"
                });

                if(response.ok) {
                  alert("See You Again");
                  window.location.href = "/login";
                } else {
                  alert("로그아웃 실패");
                }
              } catch(err) {
                console.log("Logout Error", err);
                alert("서버 오류로 로그아웃 실패");
              }
              }
            } 
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
        <SideBar />

        {/* Chat area */}
        <div style={{
          flex: 1,
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
                  height: '30px',
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