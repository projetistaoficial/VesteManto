public class Exercicio6 {
    public static void main(String[] args) {
        int horasEstacionado = 4;

        if (horasEstacionado <= 0) {
            System.out.println("Quantidade de horas inválida.");
        } else if (horasEstacionado <= 1) {
            System.out.println("Total a pagar: R$ 5,00");
        } else if (horasEstacionado <= 3) {
            System.out.println("Total a pagar: R$ 10,00");
        } else if (horasEstacionado <= 6) {
            System.out.println("Total a pagar: R$ 15,00");
        } else {
            System.out.println("Total a pagar: R$ 20,00");
        }
    }
}