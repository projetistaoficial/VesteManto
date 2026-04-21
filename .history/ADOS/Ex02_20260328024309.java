public class Ex02 {
    public static void main(String[] args) {
        int hora = 14;
        int minuto = 30;

        if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
            System.out.println("Horário inválido");
        } else if (hora >= 0 && hora <= 5) {
            System.out.println("Madrugada");
        } else if (hora >= 6 && hora <= 11) {
            System.out.println("Manhã");
        } else if (hora >= 12 && hora <= 17) {
            System.out.println("Tarde");
        } else {
            System.out.println("Noite");
        }
    }
}