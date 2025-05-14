package project.backend.domain.chat.chatmessage.app;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.git.GitMessageDto;
import project.backend.domain.chat.chatmessage.dto.git.GitEventType;
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
        switch (eventType) {
            case "issues" -> handleIssueOpen(roomId, payload);
            case "pull_request" -> handlePullRequest(roomId, payload);
            case "pull_request_review" -> handlePullRequestReview(roomId, payload);
            default -> log.info("Unhandled event: " + eventType);
        }
    }

    private void handleIssueOpen(Long roomId, Map<String, Object> payload) {
        String action = (String) payload.get("action");

        //오픈된 이슈만 처리
        if (!action.equals("opened")) {
            return;
        }

        Map<String, Object> issue = (Map<String, Object>) payload.get("issue");
        Map<String, Object> sender = (Map<String, Object>) payload.get("sender");

        String title = (String) issue.get("title");
        String url = (String) issue.get("html_url");
        String author = (String) sender.get("login");

        String content = "[issue " + action + "] " + title + " by " + author + "\n" + url;

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        GitMessageDto gitMessageDto = GitMessageDto.create(room, GitEventType.ISSUE_OPEN, author,
            content);

        sendGitMessage(roomId, gitMessageDto);
    }

    private void handlePullRequest(Long roomId, Map<String, Object> payload) {
        String action = (String) payload.get("action");
        Map<String, Object> pr = (Map<String, Object>) payload.get("pull_request");
        Map<String, Object> sender = (Map<String, Object>) payload.get("sender");

        String title = (String) pr.get("title");
        String url = (String) pr.get("html_url");
        String author = (String) sender.get("login");

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        String content;
        GitEventType type;

        if (action.equals("opened")) { //pr이 open된 경우
            content = "[PR opened] " + title + " by " + author + "\n" + url;
            type = GitEventType.PR_OPEN;
        } else if (action.equals("closed") && Boolean.TRUE.equals(
            pr.get("merged"))) { //pr이 merge된 경우
            String fromBranch = ((Map<String, Object>) pr.get("head")).get("ref").toString();
            String toBranch = ((Map<String, Object>) pr.get("base")).get("ref").toString();

            content = "[PR merged] " + title + " by " + author + "\n"
                + "merged to " + toBranch + " from " + fromBranch + "\n"
                + url;
            type = GitEventType.PR_MERGED;
        } else {
            return;
        }

        GitMessageDto gitMessageDto = GitMessageDto.create(room, type, author,
            content);

        sendGitMessage(roomId, gitMessageDto);
    }

    private void handlePullRequestReview(Long roomId, Map<String, Object> payload) {
        String action = (String) payload.get("action");
        if (!action.equals("submitted")) {
            return;
        }

        Map<String, Object> review = (Map<String, Object>) payload.get("review");
        Map<String, Object> pr = (Map<String, Object>) payload.get("pull_request");

        String reviewer = (String) ((Map<String, Object>) review.get("user")).get("login");
        String state = (String) review.get("state"); // approved, commented, changes_requested
        String reviewUrl = (String) review.get("html_url");
        String prTitle = (String) pr.get("title");
        String body = (String) review.get("body");

        String content;
        if (body == null) {
            content = "[PR review: " + state + "] " + prTitle + " review by " + reviewer + "\n"
                + reviewUrl;
        } else {
            content = "[PR review: " + state + "] " + prTitle + " review by " + reviewer + "\n"
                + body + "\n" + reviewUrl;
        }

        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        GitMessageDto dto = GitMessageDto.create(room, GitEventType.PR_REVIEW, reviewer,
            content);

        sendGitMessage(roomId, dto);
    }

    private void sendGitMessage(Long roomId, GitMessageDto dto) {
        ChatMessage message = chatMessageMapper.toEntity(dto);
        chatMessageRepository.save(message);
        ChatMessageResponse response = chatMessageMapper.toGitResponse(message);

        messagingTemplate.convertAndSend("/topic/chat/" + roomId, response);
    }

}
