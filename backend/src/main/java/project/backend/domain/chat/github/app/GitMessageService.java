package project.backend.domain.chat.github.app;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.chat.github.GitHubClient;
import project.backend.domain.chat.github.GitRepoUrlUtils;
import project.backend.domain.chat.github.dto.GitMessageDto;
import project.backend.domain.chat.github.dto.GitRepoDto;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.errorcode.GitHubErrorCode;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.ex.GitHubException;

@Service
@Slf4j
@RequiredArgsConstructor
public class GitMessageService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageMapper chatMessageMapper;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${url.ngrok}")
    private String ngrokUrl;
    @Value("${github.personal.access_token}")
    private String accessToken;
    private final GitHubClient gitHubClient;

    @Transactional
    public void handleEvent(Long roomId, String eventType, Map<String, Object> payload) {
        GitMessageDto gitMessage = switch (eventType) {
            case "issues" -> GitMessageDto.fromIssue(payload);
            case "pull_request" -> GitMessageDto.fromPullRequest(payload);
            case "pull_request_review" -> GitMessageDto.fromPullRequestReview(payload);
            default -> null;
        };

        if (gitMessage == null) {
            return;
        }

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        sendGitMessage(roomId, gitMessage.attachRoom(gitMessage, room));
    }

    private void sendGitMessage(Long roomId, GitMessageDto gitMessage) {
        ChatMessage message = chatMessageMapper.toEntityWithGit(gitMessage);
        chatMessageRepository.save(message);
        ChatMessageResponse response = chatMessageMapper.toGitResponse(message);

        messagingTemplate.convertAndSend("/topic/chat/" + roomId, response);
    }

    //레디스에서 accesstoken 키값: token
    // todo 레디스에서 엑토 받아오기
    public void registerWebhook(String repoUrl, Long roomId) {
        GitRepoDto gitRepoDto = GitRepoUrlUtils.validateAndParseUrl(repoUrl);

        log.info("owner = {}", gitRepoDto.ownerName());
        log.info("repo = {}", gitRepoDto.repoName());

        // Webhook 자동 등록 시도
        String webhookUrl = makeWebhookUrl(roomId);

        //사용자가 해당 레포에 권한이 있는지 확인
        gitHubClient.validateAdminPermission(accessToken,
            gitRepoDto.ownerName(), gitRepoDto.repoName());

        //있으면 다음 단계로 넘어감
        gitHubClient.registerWebhook(accessToken,
            gitRepoDto.ownerName(), gitRepoDto.repoName(), webhookUrl);
    }

    private String makeWebhookUrl(Long roomId) {
        return ngrokUrl + "/github/" + roomId;
    }

}
