package project.backend.domain.dm.dmMessage.app;

import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.auth.dto.MemberDetails;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.dm.dmRoom.app.DmRoomService;
import project.backend.domain.dm.dmMessage.dao.DmMessageRepository;
import project.backend.domain.dm.dmMessage.dto.DmMessageRequest;
import project.backend.domain.dm.dmMessage.dto.DmMessageHistoryResponse;
import project.backend.domain.dm.dmMessage.dto.DmMessageResponse;
import project.backend.domain.dm.dmMessage.entity.DmMessage;
import project.backend.domain.dm.dmRoom.entity.DmRoom;
import project.backend.domain.member.entity.Member;
import project.backend.domain.notification.dto.NotificationDto;
import project.backend.global.exception.errorcode.DmErrorCode;
import project.backend.global.exception.ex.DmException;

@Service
@RequiredArgsConstructor
public class DmMessageService {

    private final DmRoomService dmRoomService;
    private final DmMessageRepository dmMessageRepository;
    private final MemberService memberService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public DmMessageResponse save(Long roomId, DmMessageRequest request, Authentication auth) {
        MemberDetails memberDetails = memberService.checkAuthentication(auth);
        Member sender = memberService.getMemberById(memberDetails.getId());

        DmRoom room = dmRoomService.getDmRoomById(roomId);

        DmMessage dmMessage = new DmMessage(room, sender, request.content(), request.type());

        NotificationDto notificationDto = NotificationDto.ofDmMessage(dmMessage,
            request.receiverUsername());

        DmMessageResponse response = DmMessageResponse.from(dmMessageRepository.save(dmMessage));
        messagingTemplate.convertAndSend("/topic/dm/" + roomId, response);

        messagingTemplate.convertAndSend(
            "/topic/notifications/" + notificationDto.receiverUsername(),
            notificationDto);
        return response;
    }

    @Transactional
    public DmMessageResponse saveEvent(DmMessageResponse dmEvent) {
        DmRoom room = dmRoomService.getDmRoomById(dmEvent.roomId());
        Member member = memberService.getMemberById(dmEvent.senderId());

        DmMessage dmMessage = new DmMessage(room, member, dmEvent.content(), dmEvent.type());

        DmMessage save = dmMessageRepository.save(dmMessage);
        return DmMessageResponse.from(save);
    }

    @Transactional(readOnly = true)
    public DmMessageHistoryResponse getDmMessages(Long roomId, LocalDateTime cursorSentAt,
        Long cursorId, int size, Authentication auth) {

        memberService.checkAuthentication(auth);
        if (size < 1 || size > 100) {
            throw new DmException(DmErrorCode.INVALID_HISTORY_SIZE);
        }
        if ((cursorSentAt == null) != (cursorId == null)) {
            throw new DmException(DmErrorCode.INVALID_HISTORY_CURSOR);
        }

        PageRequest pageRequest = PageRequest.of(0, size + 1);
        List<Long> messageIds = cursorSentAt == null
            ? dmMessageRepository.findLatestMessageIdsByRoomId(roomId, pageRequest)
            : dmMessageRepository.findMessageIdsBeforeCursor(
                roomId, cursorSentAt, cursorId, pageRequest);
        if (messageIds.isEmpty()) {
            return new DmMessageHistoryResponse(List.of(), null, false);
        }

        boolean hasNext = messageIds.size() > size;
        List<Long> currentMessageIds = hasNext ? messageIds.subList(0, size) : messageIds;
        Map<Long, DmMessage> messagesById = dmMessageRepository.findAllWithSenderByIdIn(
                currentMessageIds).stream()
            .collect(Collectors.toMap(DmMessage::getId, Function.identity()));

        List<DmMessageResponse> content = currentMessageIds.stream()
            .map(messageId -> DmMessageResponse.from(messagesById.get(messageId)))
            .toList();
        DmMessageHistoryResponse.Cursor nextCursor = hasNext
            ? new DmMessageHistoryResponse.Cursor(
                content.getLast().sendAt(), content.getLast().messageId())
            : null;

        return new DmMessageHistoryResponse(content, nextCursor, hasNext);
    }
}
