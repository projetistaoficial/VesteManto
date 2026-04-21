public class Ex08 {
    public static void main(String[] args) {
        int ano = 2024;
        int mes = 2;

        if (mes < 1 || mes > 12) {
            System.out.println("Mês inválido.");
        } else if (mes == 2) {
            if ((ano % 4 == 0 && ano % 100 != 0) || (ano % 400 == 0)) {
                System.out.println("O mês " + mes + " de " + ano + " tem 29 dias.");
            } else {
                System.out.println("O mês " + mes + " de " + ano + " tem 28 dias.");
            }
        } else if (mes == 4 || mes == 6 || mes == 9 || mes == 11) {
            System.out.println("O mês " + mes + " de " + ano + " tem 30 dias.");
        } else {
            System.out.println("O mês " + mes + " de " + ano + " tem 31 dias.");
        }
    }
}