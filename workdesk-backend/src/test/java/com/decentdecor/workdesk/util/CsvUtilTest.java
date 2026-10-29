package com.decentdecor.workdesk.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class CsvUtilTest {
    @Test
    void cellsAreSafeForExcel() {
        assertEquals("Priya", CsvUtil.cell("Priya"));
        assertEquals("\"Sharma, Priya\"", CsvUtil.cell("Sharma, Priya"));
        assertEquals("\"say \"\"hi\"\"\"", CsvUtil.cell("say \"hi\""));
        assertEquals("\"'=1+1\"", CsvUtil.cell("=1+1"));
        assertEquals("\"'-5\"", CsvUtil.cell("-5"));
        assertEquals("-5", CsvUtil.cell(-5));
        assertEquals("", CsvUtil.cell(null));
    }

    @Test
    void rows() {
        assertEquals("Priya Sharma,,3,50.0,", CsvUtil.row(Arrays.asList("Priya Sharma", null, 3L, 50.0, null)));
    }
}
