package project.backend.domain.chat.chatmessage.app;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.git.GitMessage;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.ex.ChatRoomException;

@Service
@Slf4j
@RequiredArgsConstructor
public class GitMessageService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageMapper chatMessageMapper;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void handleEvent(Long roomId, String eventType, Map<String, Object> payload) {
        GitMessage gitMessage = switch (eventType) {
            case "issues" -> GitMessage.fromIssue(payload);
            case "pull_request" -> GitMessage.fromPullRequest(payload);
            case "pull_request_review" -> GitMessage.fromPullRequestReview(payload);
            default -> null;
        };

        if (gitMessage == null) {
            return;
        }

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        sendGitMessage(roomId, gitMessage.attachRoom(gitMessage, room));
    }

    private void sendGitMessage(Long roomId, GitMessage gitMessage) {
        ChatMessage message = chatMessageMapper.toEntity(gitMessage);
        chatMessageRepository.save(message);
        ChatMessageResponse response = chatMessageMapper.toGitResponse(message);

        messagingTemplate.convertAndSend("/topic/chat/" + roomId, response);
    }

}
