package project.backend.domain.dm.dmMessage.app;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import project.backend.domain.dm.dmMessage.DmMessageType;
import project.backend.domain.dm.dmMessage.dao.DmMessageRepository;
import project.backend.domain.dm.dmMessage.dto.DmMessageResponse;
import project.backend.domain.dm.dmMessage.entity.DmMessage;
import project.backend.domain.dm.dmRoom.app.DmRoomService;
import project.backend.domain.dm.dmRoom.entity.DmRoom;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.entity.Member;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class DmMessageServiceTest {

    @Mock DmRoomService dmRoomService;
    @Mock DmMessageRepository dmMessageRepository;
    @Mock MemberService memberService;
    @Mock SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("DM 응답은 ID Page 순서를 유지한다")
    void getDmMessages_preservesTheIdPageOrderAfterFetchingSenders() {
        DmMessageService service = new DmMessageService(
            dmRoomService, dmMessageRepository, memberService, messagingTemplate);
        PageRequest pageRequest = PageRequest.of(0, 2);
        DmMessage newer = message(20L, "newer");
        DmMessage older = message(10L, "older");

        when(memberService.checkAuthentication(any())).thenReturn(mock(project.backend.auth.dto.MemberDetails.class));
        when(dmMessageRepository.findMessageIdsByRoomId(1L, pageRequest))
            .thenReturn(new PageImpl<>(List.of(20L, 10L), pageRequest, 12));
        when(dmMessageRepository.findAllWithSenderByIdIn(List.of(20L, 10L)))
            .thenReturn(List.of(older, newer));

        var result = service.getDmMessages(1L, pageRequest, mock(org.springframework.security.core.Authentication.class));

        assertThat(result.getTotalElements()).isEqualTo(12);
        assertThat(result.getContent()).extracting(DmMessageResponse::messageId)
            .containsExactly(20L, 10L);
    }

    private DmMessage message(Long id, String content) {
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
        when(message.getSentAt()).thenReturn(LocalDateTime.of(2026, 1, 1, 0, 0));
        return message;
    }
}
