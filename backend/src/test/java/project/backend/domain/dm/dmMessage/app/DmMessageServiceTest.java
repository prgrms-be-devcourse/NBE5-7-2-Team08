package project.backend.domain.dm.dmMessage.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.backend.domain.dm.dmMessage.DmMessageType;
import project.backend.domain.dm.dmMessage.dao.DmMessageRepository;
import project.backend.domain.dm.dmMessage.dto.DmMessageResponse;
import project.backend.domain.dm.dmMessage.entity.DmMessage;
import project.backend.domain.dm.dmRoom.app.DmRoomService;
import project.backend.domain.dm.dmRoom.entity.DmRoom;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.entity.Member;
import project.backend.global.exception.ex.DmException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class DmMessageServiceTest {

    @Mock DmRoomService dmRoomService;
    @Mock DmMessageRepository dmMessageRepository;
    @Mock MemberService memberService;
    @Mock SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("size+1개가 조회되면 응답 순서를 유지하고 마지막 응답을 다음 커서로 반환한다")
    void getDmMessages_withLookahead_returnsHasNextAndLastResponseCursor() {
        DmMessageService service = new DmMessageService(
            dmRoomService, dmMessageRepository, memberService, messagingTemplate);
        DmMessage newest = message(30L, "newest", LocalDateTime.of(2026, 1, 1, 0, 3));
        DmMessage cursorMessage = message(20L, "cursor", LocalDateTime.of(2026, 1, 1, 0, 2));

        when(memberService.checkAuthentication(any())).thenReturn(mock(project.backend.auth.dto.MemberDetails.class));
        when(dmMessageRepository.findLatestMessageIdsByRoomId(any(), any()))
            .thenReturn(List.of(30L, 20L, 10L));
        when(dmMessageRepository.findAllWithSenderByIdIn(List.of(30L, 20L)))
            .thenReturn(List.of(cursorMessage, newest));

        var result = service.getDmMessages(
            1L, null, null, 2, mock(org.springframework.security.core.Authentication.class));

        assertThat(result.hasNext()).isTrue();
        assertThat(result.content()).extracting(DmMessageResponse::messageId)
            .containsExactly(30L, 20L);
        assertThat(result.nextCursor().messageId()).isEqualTo(20L);
        assertThat(result.nextCursor().sentAt()).isEqualTo(LocalDateTime.of(2026, 1, 1, 0, 2));
    }

    @Test
    @DisplayName("조회 결과가 size 이하면 마지막 페이지를 반환한다")
    void getDmMessages_withoutLookahead_returnsLastPage() {
        DmMessageService service = new DmMessageService(
            dmRoomService, dmMessageRepository, memberService, messagingTemplate);
        DmMessage message = message(20L, "last", LocalDateTime.of(2026, 1, 1, 0, 2));

        when(memberService.checkAuthentication(any())).thenReturn(mock(project.backend.auth.dto.MemberDetails.class));
        when(dmMessageRepository.findLatestMessageIdsByRoomId(any(), any()))
            .thenReturn(List.of(20L));
        when(dmMessageRepository.findAllWithSenderByIdIn(List.of(20L)))
            .thenReturn(List.of(message));

        var result = service.getDmMessages(
            1L, null, null, 2, mock(org.springframework.security.core.Authentication.class));

        assertThat(result.hasNext()).isFalse();
        assertThat(result.nextCursor()).isNull();
        assertThat(result.content()).extracting(DmMessageResponse::messageId)
            .containsExactly(20L);
    }

    @Test
    @DisplayName("복합 커서 중 하나만 전달하면 요청을 거부한다")
    void getDmMessages_withPartialCursor_rejectsRequest() {
        DmMessageService service = new DmMessageService(
            dmRoomService, dmMessageRepository, memberService, messagingTemplate);
        when(memberService.checkAuthentication(any())).thenReturn(mock(project.backend.auth.dto.MemberDetails.class));

        assertThatThrownBy(() -> service.getDmMessages(
            1L, LocalDateTime.of(2026, 1, 1, 0, 2), null, 20,
            mock(org.springframework.security.core.Authentication.class)))
            .isInstanceOf(DmException.class);
    }

    private DmMessage message(Long id, String content, LocalDateTime sentAt) {
        DmMessage message = mock(DmMessage.class);
        DmRoom room = mock(DmRoom.class);
        Member sender = mock(Member.class);
        when(room.getId()).thenReturn(1L);
        when(sender.getId()).thenReturn(2L);
        when(sender.getNickname()).thenReturn("sender");
        when(message.getId()).thenReturn(id);
        when(message.getRoom()).thenReturn(room);
        when(message.getSender()).thenReturn(sender);
        when(message.getContent()).thenReturn(content);
        when(message.getType()).thenReturn(DmMessageType.TEXT);
        when(message.getSentAt()).thenReturn(sentAt);
        return message;
    }
}
