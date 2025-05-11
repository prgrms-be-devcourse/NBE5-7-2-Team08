import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // 로딩 상태

  useEffect(() => {
    const token = localStorage.getItem('accessToken'); // 또는 sessionStorage

    if (!token) {
      navigate('/login'); // 토큰 없으면 로그인
      return;
    }

    axios.get(`http://localhost:8080/chat-rooms/recent`, { 
        headers: {
            Authorization: `Bearer ${token}` // ✅ JWT 토큰을 헤더에 첨부
        }
    })
      .then(res => {
        console.log(res.data.roomId);
        if (res.status === 204) {
          navigate('/blank'); // 참여한 방 없음
        } else {
          navigate(`/chat/${res.data.roomId}`);
        }
      })
      .catch(err => {
        if (err.response?.status === 401) {
          // 인증 안됨 → 로그인 페이지로 이동
          navigate(`/login`);
        } else {
          console.error('채팅방 이동 실패:', err);
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