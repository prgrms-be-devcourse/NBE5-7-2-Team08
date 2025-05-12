package project.backend.domain.chat.chatroom.app;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.global.exception.ex.ChatException;
import project.backend.global.exception.errorcode.ChatErrorCode;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatParticipantRepository chatParticipantRepository;

    @Transactional(readOnly = true)
    public Long getMostRecentRoomId(String email) {

        // 1순위: 가장 최근 메시지가 도착한 채팅방
        Optional<Long> recentRoomId = chatMessageRepository.findMostRecentRoomIdByMemberEmail(
            email);
        if (recentRoomId.isPresent()) {
            return recentRoomId.get();
        }

        // 2순위: 채팅방에 메세지가 없을 때 참여중인 채팅방 중 roomId가 가장 큰 채팅방
        Optional<Long> fallbackRoomId = chatParticipantRepository.findMostLargeRoomIdByEmail(email);
        if (fallbackRoomId.isPresent()) {
            return fallbackRoomId.get();
        }

        // 아무 채팅방에도 참여한 적이 없음 → 예외 던지기
        throw new ChatException(ChatErrorCode.CHATROOM_NOT_EXIST);

    }
}
