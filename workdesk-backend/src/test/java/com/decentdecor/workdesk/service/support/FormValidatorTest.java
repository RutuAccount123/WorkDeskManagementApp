package com.decentdecor.workdesk.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.decentdecor.workdesk.entity.json.FormField;
import com.decentdecor.workdesk.exception.BadRequestException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FormValidatorTest {
    final List<FormField> fields = List.of(
            new FormField("f1", "Site", "select", true, List.of("PIL", "AIGP")),
            new FormField("f2", "Material", "text", true, List.of()),
            new FormField("f3", "Quantity", "number", false, List.of()),
            new FormField("f4", "Needed by", "date", false, List.of()),
            new FormField("f5", "Urgent", "checkbox", false, List.of()));

    @Test
    void cleansAnswers() {
        Map<String, Object> out = FormValidator.clean(fields, Map.of("f1", "PIL", "f2", "  Roofing sheets ", "f3", "40", "f5", true));
        assertEquals("PIL", out.get("f1"));
        assertEquals("Roofing sheets", out.get("f2"));
        assertEquals(new BigDecimal("40"), out.get("f3"));
        assertEquals("", out.get("f4"));
        assertEquals(true, out.get("f5"));
    }

    @Test
    void explainsWhatIsWrong() {
        assertEquals("Please fill “Site”",
                assertThrows(BadRequestException.class, () -> FormValidator.clean(fields, Map.of())).getMessage());
        assertEquals("Choose a valid option for “Site”",
                assertThrows(BadRequestException.class, () -> FormValidator.clean(fields, Map.of("f1", "Other", "f2", "x"))).getMessage());
        assertEquals("“Quantity” must be a number",
                assertThrows(BadRequestException.class, () -> FormValidator.clean(fields, Map.of("f1", "PIL", "f2", "x", "f3", "ten"))).getMessage());
        assertThrows(BadRequestException.class, () -> FormValidator.clean(fields, Map.of("f1", "PIL", "f2", "x", "f4", "tomorrow")));
    }
}
