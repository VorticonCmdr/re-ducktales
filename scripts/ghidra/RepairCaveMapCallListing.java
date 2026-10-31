import ghidra.app.script.GhidraScript;
import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import java.util.Arrays;

// Analysis listing repair only. Never patch original executable bytes.
public class RepairCaveMapCallListing extends GhidraScript {
    private boolean healthy(Address first) {
        int at = 0;
        for (int length : new int[] {3, 2, 1, 3}) {
            var instruction = getInstructionAt(first.add(at));
            if (instruction == null || instruction.getLength() != length) return false;
            at += length;
        }
        return true;
    }
    public void run() throws Exception {
        if (!currentProgram.getName().equals("CAVE_CODE.EXE")) throw new Exception("Wrong analysis program");
        var first = toAddr("1c17:00a4"); var last = toAddr("1c17:00ac");
        byte[] expected = {(byte)0x83, (byte)0xc4, 2, 0x2b, (byte)0xc0, 0x50, (byte)0xff, 0x76, 6};
        byte[] actual = new byte[9];
        if (currentProgram.getMemory().getBytes(first, actual) != 9 || !Arrays.equals(actual, expected))
            throw new Exception("Unexpected original map-call bytes");
        if (healthy(first)) { println("Already healthy:nine original bytes/four instructions;no mutation"); return; }
        int tx = currentProgram.startTransaction("Repair bounded cave map-call listing"); boolean ok = false;
        try {
            currentProgram.getListing().clearCodeUnits(first, last, false);
            var command = new DisassembleCommand(first, new AddressSet(first, last), false);
            if (!command.applyTo(currentProgram, monitor) || !healthy(first))
                throw new Exception("Bounded disassembly did not cover nine bytes");
            ok = true;
            println("Repaired listing:nine original bytes/four instructions;executable bytes unchanged");
        } finally { currentProgram.endTransaction(tx, ok); }
    }
}
