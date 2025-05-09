package project.backend.domain.chat.chatmessage.app;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.global.exception.ChatException;
import project.backend.global.exception.MemberException;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final MemberRepository memberRepository;
    private final ChatParticipantRepository chatParticipantRepository;

    @Transactional
    public void save(Long roomId, ChatMessageRequest request, String email) {
        Member sender = memberRepository.findByEmail(email)
            .orElseThrow(() -> new MemberException("사용자 정보를 찾을 수 없습니다."));

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatException("채팅방을 찾을 수 없습니다."));

    }
}
