package project.backend.domain.chat.chatroom.app;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatParticipantRepository chatParticipantRepository;

    //참여 중인 방 중, 가장 최근 메세지가 도착한 방 ID 반환
    @Transactional(readOnly = true)
    public Optional<Long> getMostRecentRoomId(String email) {

        Optional<Long> messageId = chatMessageRepository.findMostRecentRoomIdByMemberEmail(
            email);

        if (messageId.isPresent()) {
            return messageId;
        }

        //채팅방에 수신된 메세지가 없을 때 room_id가 가장 큰 채팅방 반환
        return chatParticipantRepository.findMostLargeRoomIdByEmail(email);
    }
}
