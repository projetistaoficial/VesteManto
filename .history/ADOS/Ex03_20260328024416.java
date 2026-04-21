public class Ex03 {
    public static void main(String[] args) {
        double salario = 2500.00;
        boolean nomeLimpo = true;

        if (!nomeLimpo) {
            System.out.println("Empréstimo negado: Nome sujo.");
        } else if (salario > 3000) {
            System.out.println("Empréstimo aprovado direto.");
        } else if (salario >= 1500 && salario <= 3000) {
            System.out.println("Encaminhado para análise manual.");
        } else {
            System.out.println("Empréstimo negado: Salário insuficiente.");
        }
    }
}