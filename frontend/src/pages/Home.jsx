import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // 로딩 상태

  useEffect(() => {

    // const token = localStorage.getItem('accessToken'); // 또는 sessionStorage

    // if (!token) {
    //   navigate('/login'); // 토큰 없으면 로그인
    //   return;
    // }

    axios.get(`http://localhost:8080/chat-rooms/recent`, { 
        withCredentials: true,

    })
      .then(res => {
        const roomId = res.data.roomId;
        console.log(roomId);
        if (roomId) {
            navigate(`/chat/${roomId}`);
        } else {
            console.warn('roomId가 응답에 없음');
            navigate('/blank'); // fallback
        }
      })
      .catch(err => {
        const status = err.response?.status;
        if (status === 404) {
          navigate('/blank'); // 참여 중인 채팅방 없음
        } else if (status === 401) {
          navigate('/login'); // 인증 필요
        } else {
          console.error('채팅방 이동 실패:', status);
          alert(err);

        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  if(loading){
    return <div>가장 최근 채팅방으로 이동 중...</div>;
  }
};

export default Home;